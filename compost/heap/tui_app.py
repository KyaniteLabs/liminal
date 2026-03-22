#!/usr/bin/env python3
"""
Research Pipeline Dashboard TUI - For Ghostty split usage

A Textual-based TUI for monitoring research pipeline state.
Designed to run side-by-side with Claude Code in terminal splits.

Usage:
    cd human-door
    python tui_app.py

Key bindings:
    q - Quit
    r - Refresh data
    1-5 - Switch views (Status/Experiments/Inbox/Archive/Pipeline)
    e - Edit selected item (in Inbox)
    Enter - View/Select item
    Escape - Back/Cancel
"""

from textual.app import App, ComposeResult
from textual.widgets import (
    Header, Footer, ListView, ListItem, Label,
    Input, TextArea, Static, Button
)
from textual.containers import Container, Horizontal, Vertical, ScrollableContainer
from textual.screen import Screen, ModalScreen
from textual import events
from pathlib import Path
from typing import Dict, List, Any, Optional
import json

# Import parsers
from parsers import parse_progress, parse_experiments
from parsers.inbox import list_inbox
from parsers.archive import list_archive

PIPELINE_ROOT = Path(__file__).parent.parent


class EditModal(ModalScreen):
    """Modal for editing inbox items."""

    BINDINGS = [
        ("escape", "cancel", "Cancel"),
        ("ctrl+s", "save", "Save"),
    ]

    def __init__(self, filename: str, content: str, title: str = "Edit"):
        super().__init__()
        self.filename = filename
        self.initial_content = content
        self.modal_title = title

    def compose(self) -> ComposeResult:
        with Container(classes="modal-container"):
            yield Static(self.modal_title, classes="modal-title")
            yield TextArea(self.initial_content, id="edit-textarea", language="markdown")
            with Horizontal(classes="modal-buttons"):
                yield Button("Cancel", id="cancel-btn", variant="default")
                yield Button("Save (Ctrl+S)", id="save-btn", variant="success")

    def on_button_pressed(self, event: Button.Pressed) -> None:
        if event.button.id == "save-btn":
            self.action_save()
        else:
            self.action_cancel()

    def action_save(self) -> None:
        textarea = self.query_one("#edit-textarea", TextArea)
        self.dismiss((True, textarea.text))

    def action_cancel(self) -> None:
        self.dismiss((False, None))


class ViewModal(ModalScreen):
    """Modal for viewing file content."""

    BINDINGS = [
        ("escape", "close", "Close"),
        ("q", "close", "Close"),
    ]

    def __init__(self, title: str, content: str):
        super().__init__()
        self.view_title = title
        self.content = content

    def compose(self) -> ComposeResult:
        with Container(classes="modal-container"):
            yield Static(self.view_title, classes="modal-title")
            with ScrollableContainer(classes="modal-scroll"):
                yield Static(self.content, id="view-content")
            with Horizontal(classes="modal-buttons"):
                yield Button("Close (Esc/Q)", id="close-btn", variant="default")

    def on_button_pressed(self, event: Button.Pressed) -> None:
        self.action_close()

    def action_close(self) -> None:
        self.dismiss()


class StatusView(Screen):
    """Status view showing RQS and current state."""

    BINDINGS = [
        ("r", "refresh", "Refresh"),
    ]

    def compose(self) -> ComposeResult:
        with ScrollableContainer(classes="main-scroll"):
            yield Static("", id="status-header", classes="header")
            yield Static("", id="rqs-display", classes="rqs-box")
            yield Static("", id="component-bars", classes="components")
            yield Static("", id="weakest-section", classes="weakest-box")
            yield Static("", id="current-state", classes="state-box")

    def on_mount(self) -> None:
        self.load_data()

    def load_data(self) -> None:
        progress_path = PIPELINE_ROOT / "PROGRESS.md"
        if progress_path.exists():
            content = progress_path.read_text()
            self.data = parse_progress(content)
        else:
            self.data = {"status": "NOT_FOUND"}
        self.render_data()

    def render_data(self) -> None:
        d = self.data

        # Header
        topic = d.get("topic", "No active research")
        stage = d.get("stage", "")
        header = f"[bold cyan]RESEARCH PIPELINE[/bold cyan]\n{stage} • {topic}"
        self.query_one("#status-header", Static).update(header)

        # RQS
        rqs = d.get("rqs", {})
        total = rqs.get("total", "--")
        trend = d.get("trend", "stable")
        trend_icon = {"improving": "↑", "declining": "↓", "stable": "→"}.get(trend, "→")
        trend_color = {"improving": "green", "declining": "red", "stable": "dim"}.get(trend, "dim")
        rqs_text = f"[bold green]RQS: {total}[/bold green] [{trend_color}]{trend_icon} {trend}[/{trend_color}]"
        self.query_one("#rqs-display", Static).update(rqs_text)

        # Components - with dynamic weakest calculation
        components = [
            ("source", "Source Credibility"),
            ("depth", "Depth"),
            ("actionability", "Actionability"),
            ("recency", "Recency"),
            ("gap", "Gap Fill"),
        ]

        # Calculate weakest dynamically from actual scores
        valid_scores = {label: rqs.get(key) for key, label in components if rqs.get(key) is not None}
        calculated_weakest = min(valid_scores, key=valid_scores.get) if valid_scores else None

        comp_text = ""
        for key, label in components:
            score = rqs.get(key)
            if score is not None:
                bar_len = int(score / 5)
                bar = "█" * bar_len + "░" * (20 - bar_len)
                is_weakest = calculated_weakest and label == calculated_weakest
                marker = " ⚠️ WEAKEST" if is_weakest else ""
                color = "red" if score < 60 else "yellow" if score < 70 else "green"
                comp_text += f"[dim]{label}[/dim]{marker}\n[{color}]{bar}[/{color}] {score}\n"
        self.query_one("#component-bars", Static).update(comp_text or "[dim]No component data[/dim]")

        # Weakest section with suggestion
        if calculated_weakest:
            weakest_score = valid_scores[calculated_weakest]
            weakest_text = f"[bold yellow]Focus: {calculated_weakest}[/bold yellow] ({weakest_score})\n"
            weakest_text += "[dim]Run 'research [topic]' to start improvement[/dim]"
            self.query_one("#weakest-section", Static).update(weakest_text)
        else:
            self.query_one("#weakest-section", Static).update("")

        # Current state
        state_lines = []
        if d.get("status"):
            status = d["status"]
            color = "green" if status == "COMPLETED" else "yellow"
            state_lines.append(f"[{color}]Status: {status}[/{color}]")
        if d.get("experiment"):
            state_lines.append(f"Experiment: [cyan]{d['experiment']}[/cyan]")
        if d.get("blockers") and d["blockers"] and d["blockers"] != ["--"]:
            state_lines.append(f"[red]Blockers:[/red]")
            for b in d["blockers"]:
                state_lines.append(f"  • {b}")
        self.query_one("#current-state", Static).update("\n".join(state_lines) or "[dim]No active state[/dim]")

    def action_refresh(self) -> None:
        self.load_data()


class ExperimentsView(Screen):
    """Experiments view showing active and completed experiments."""

    BINDINGS = [
        ("r", "refresh", "Refresh"),
    ]

    def compose(self) -> ComposeResult:
        with ScrollableContainer(classes="main-scroll"):
            yield Static("[bold cyan]EXPERIMENTS[/bold cyan]\nSelf-improving experiment system", classes="header")
            yield Static("", id="active-experiments", classes="section")
            yield Static("", id="completed-experiments", classes="section")
            yield Static("", id="patterns", classes="section")

    def on_mount(self) -> None:
        self.load_data()

    def load_data(self) -> None:
        log_path = PIPELINE_ROOT / "IMPROVEMENT-LOG.md"
        if log_path.exists():
            content = log_path.read_text()
            self.data = parse_experiments(content)
        else:
            self.data = {"active": [], "completed": [], "patterns": []}
        self.render_data()

    def render_data(self) -> None:
        d = self.data

        # Active experiments
        active = d.get("active", [])
        if active:
            active_text = "[bold]Active Experiments[/bold]\n"
            for e in active[:10]:
                success = e.get("success_rate", "--")
                active_text += f"  [cyan]{e['id']}[/cyan] {e['name'][:30]} • {e.get('runs', 0)} runs • {success}%\n"
        else:
            active_text = "[dim]No active experiments[/dim]"
        self.query_one("#active-experiments", Static).update(active_text)

        # Completed
        completed = d.get("completed", [])
        if completed:
            comp_text = "[bold]Recent Completions[/bold]\n"
            for e in completed[:5]:
                delta = e.get("delta", 0)
                delta_color = "green" if delta >= 3 else "yellow" if delta >= 0 else "red"
                comp_text += f"  [cyan]{e['id']}[/cyan] {e['experiment'][:25]} • [{delta_color}]{delta:+d}[/{delta_color}] {e.get('success', '')}\n"
        else:
            comp_text = "[dim]No completed experiments yet[/dim]"
        self.query_one("#completed-experiments", Static).update(comp_text)

        # Patterns
        patterns = d.get("patterns", [])
        if patterns:
            pat_text = "[bold]Patterns That Work[/bold]\n"
            for p in patterns[:5]:
                pat_text += f"  • {p['pattern']}\n"
        else:
            pat_text = "[dim]No patterns learned yet[/dim]"
        self.query_one("#patterns", Static).update(pat_text)

    def action_refresh(self) -> None:
        self.load_data()


class InboxView(Screen):
    """Inbox view showing pending research ideas with edit capability."""

    BINDINGS = [
        ("r", "refresh", "Refresh"),
        ("e", "edit", "Edit"),
        ("n", "new_item", "New"),
        ("enter", "view", "View"),
    ]

    current_index: int = 0

    def compose(self) -> ComposeResult:
        with Container(classes="main-container"):
            yield Static("", id="inbox-header", classes="header")
            yield Static("[dim]Enter=View • E=Edit • N=New • R=Refresh[/dim]", id="inbox-hint", classes="hint")
            yield ListView(id="inbox-list")

    def on_mount(self) -> None:
        self.load_data()

    def on_list_view_selected(self, event: ListView.Selected) -> None:
        """Handle item selection."""
        self.current_index = event.list_view.index or 0
        self.action_view()

    def load_data(self) -> None:
        inbox_dir = PIPELINE_ROOT / "inbox"
        self.items = list_inbox(inbox_dir)
        self.render_data()

    def render_data(self) -> None:
        header = f"[bold cyan]INBOX[/bold cyan]\n{len(self.items)} pending research ideas"
        self.query_one("#inbox-header", Static).update(header)

        list_view = self.query_one("#inbox-list", ListView)
        list_view.clear()

        for item in self.items:
            title = item.get("title", "Untitled")
            date = item.get("date", "")
            preview = item.get("preview", "")[:40]
            text = f"📥 {title}\n[dim]{date} • {preview}[/dim]"
            list_view.append(ListItem(Label(text)))

    def action_view(self) -> None:
        """View selected inbox item."""
        list_view = self.query_one("#inbox-list", ListView)
        idx = list_view.index
        if idx is None or idx >= len(self.items):
            return

        item = self.items[idx]
        filename = item.get("filename")
        if not filename:
            return

        filepath = PIPELINE_ROOT / "inbox" / filename
        if filepath.exists():
            content = filepath.read_text()
            self.app.push_screen(ViewModal(item.get("title", filename), content))

    def action_edit(self) -> None:
        """Edit selected inbox item."""
        list_view = self.query_one("#inbox-list", ListView)
        idx = list_view.index
        if idx is None or idx >= len(self.items):
            return

        item = self.items[idx]
        filename = item.get("filename")
        if not filename:
            return

        filepath = PIPELINE_ROOT / "inbox" / filename
        if filepath.exists():
            content = filepath.read_text()
            title = item.get("title", filename)

            def on_save(result):
                if result and result[0]:  # Saved
                    new_content = result[1]
                    filepath.write_text(new_content)
                    self.load_data()

            self.app.push_screen(EditModal(filename, content, f"Edit: {title}"), on_save)

    def action_new_item(self) -> None:
        """Create new inbox item."""
        def on_save(result):
            if result and result[0]:  # Saved
                content = result[1]
                title = content.split('\n')[0][:50] or "Untitled"
                from parsers.inbox import create_inbox_item
                inbox_dir = PIPELINE_ROOT / "inbox"
                create_inbox_item(inbox_dir, title, content)
                self.load_data()

        self.app.push_screen(EditModal("new.md", "", "New Research Idea"), on_save)

    def action_refresh(self) -> None:
        self.load_data()


class ArchiveView(Screen):
    """Archive view showing completed research."""

    BINDINGS = [
        ("r", "refresh", "Refresh"),
    ]

    def compose(self) -> ComposeResult:
        with ScrollableContainer(classes="main-scroll"):
            yield Static("", id="archive-header", classes="header")
            yield Static("", id="high-value", classes="section")
            yield Static("", id="reviewed", classes="section")

    def on_mount(self) -> None:
        self.load_data()

    def load_data(self) -> None:
        archive_dir = PIPELINE_ROOT / "archive"
        self.data = list_archive(archive_dir)
        self.render_data()

    def render_data(self) -> None:
        d = self.data
        total = len(d.get("high_value", [])) + len(d.get("reviewed", [])) + len(d.get("rejected", []))
        header = f"[bold cyan]ARCHIVE[/bold cyan]\n{total} completed research outputs"
        self.query_one("#archive-header", Static).update(header)

        # High Value
        high_value = d.get("high_value", [])
        if high_value:
            hv_text = "[bold green]High Value (RQS 90+)[/bold green]\n"
            for item in high_value:
                hv_text += f"  📊 {item['name']} • RQS {item.get('rqs', '--')}\n"
        else:
            hv_text = "[dim]No high-value outputs yet[/dim]"
        self.query_one("#high-value", Static).update(hv_text)

        # Reviewed
        reviewed = d.get("reviewed", [])
        if reviewed:
            rev_text = "[bold yellow]Reviewed (RQS 60-89)[/bold yellow]\n"
            for item in reviewed[:10]:
                rev_text += f"  📄 {item['name']} • RQS {item.get('rqs', '--')}\n"
        else:
            rev_text = "[dim]No reviewed outputs yet[/dim]"
        self.query_one("#reviewed", Static).update(rev_text)

    def action_refresh(self) -> None:
        self.load_data()


class PipelineView(Screen):
    """Pipeline flow view showing stage progress with file viewing."""

    BINDINGS = [
        ("r", "refresh", "Refresh"),
        ("enter", "view_stage", "View"),
    ]

    def compose(self) -> ComposeResult:
        with Container(classes="main-container"):
            yield Static("", id="pipeline-header", classes="header")
            yield Static("[dim]Enter=View files • R=Refresh[/dim]", id="pipeline-hint", classes="hint")
            yield ListView(id="stage-list")

    def on_mount(self) -> None:
        self.load_data()

    def on_list_view_selected(self, event: ListView.Selected) -> None:
        """Handle stage selection."""
        self.action_view_stage()

    def load_data(self) -> None:
        progress_path = PIPELINE_ROOT / "PROGRESS.md"
        if progress_path.exists():
            content = progress_path.read_text()
            self.status_data = parse_progress(content)
        else:
            self.status_data = {}

        # Get stages
        stages_dir = PIPELINE_ROOT / "stages"
        self.stages = []
        if stages_dir.exists():
            for stage_dir in sorted(stages_dir.iterdir()):
                if stage_dir.is_dir():
                    output_dir = stage_dir / "output"
                    files = list(output_dir.glob("*.md")) if output_dir.exists() else []
                    self.stages.append({
                        "name": stage_dir.name,
                        "files": [f.name for f in files],
                        "path": str(stage_dir.relative_to(PIPELINE_ROOT))
                    })

        self.render_data()

    def render_data(self) -> None:
        d = self.status_data
        topic = d.get("topic", "No active research")
        header = f"[bold cyan]PIPELINE[/bold cyan]\n{topic}"
        self.query_one("#pipeline-header", Static).update(header)

        current_stage = d.get("stage", "")
        current_idx = None

        for idx, stage in enumerate(self.stages):
            if stage["name"] == current_stage:
                current_idx = idx

        list_view = self.query_one("#stage-list", ListView)
        list_view.clear()

        for idx, stage in enumerate(self.stages):
            name = stage["name"]
            files = stage["files"]

            if idx == current_idx or (current_idx is None and idx == 0):
                status = "[bold yellow]● CURRENT[/bold yellow]"
            elif current_idx is not None and idx < current_idx:
                status = "[green]✓ done[/green]"
            else:
                status = "[dim]○ pending[/dim]"

            files_hint = f" ({len(files)} files)" if files else ""
            text = f"{status} {name}{files_hint}"
            list_view.append(ListItem(Label(text)))

    def action_view_stage(self) -> None:
        """View files in selected stage."""
        list_view = self.query_one("#stage-list", ListView)
        idx = list_view.index
        if idx is None or idx >= len(self.stages):
            return

        stage = self.stages[idx]
        files = stage.get("files", [])

        if not files:
            return

        # View first file
        filepath = PIPELINE_ROOT / stage["path"] / "output" / files[0]
        if filepath.exists():
            content = filepath.read_text()
            title = f"{stage['name']}: {files[0]}"
            self.app.push_screen(ViewModal(title, content))

    def action_refresh(self) -> None:
        self.load_data()


class DashboardTUI(App):
    """Research Pipeline Dashboard TUI Application."""

    CSS = """
    Screen {
        background: $surface;
        padding: 1;
    }

    .header {
        text-align: left;
        padding: 1;
        margin-bottom: 1;
    }

    .hint {
        color: $text-muted;
        padding: 0 1;
        margin-bottom: 1;
    }

    .main-container {
        height: 100%;
    }

    .main-scroll {
        height: 100%;
    }

    .rqs-box, .weakest-box, .components, .state-box, .section {
        background: $panel;
        padding: 1;
        margin-bottom: 1;
    }

    ListView {
        height: 1fr;
    }

    ListItem {
        padding: 1;
    }

    ListItem:focus {
        background: $accent 20%;
    }

    ListItem:hover {
        background: $accent 10%;
    }

    /* Modal styles */
    .modal-container {
        background: $surface;
        border: thick $accent;
        padding: 1;
        width: 90%;
        height: 85%;
        margin: 2;
    }

    .modal-title {
        text-align: center;
        color: $accent;
        padding: 1;
        margin-bottom: 1;
        text-style: bold;
    }

    .modal-scroll {
        height: 1fr;
        padding: 1;
        background: $panel;
        overflow: auto;
    }

    .modal-buttons {
        align: center middle;
        height: auto;
        margin-top: 1;
    }

    .modal-buttons Button {
        margin: 0 1;
    }

    TextArea {
        height: 1fr;
        background: $panel;
    }

    #view-content {
        white-space: pre-wrap;
    }
    """

    BINDINGS = [
        ("q", "quit", "Quit"),
        ("r", "refresh", "Refresh"),
        ("1", "status", "Status"),
        ("2", "experiments", "Experiments"),
        ("3", "inbox", "Inbox"),
        ("4", "archive", "Archive"),
        ("5", "pipeline", "Pipeline"),
    ]

    def __init__(self):
        super().__init__()
        self._current_view = "status"

    def on_mount(self) -> None:
        self.push_screen(StatusView())

    def action_refresh(self) -> None:
        screen = self.screen
        if hasattr(screen, 'load_data'):
            screen.load_data()

    def action_status(self) -> None:
        self._switch_view(StatusView())

    def action_experiments(self) -> None:
        self._switch_view(ExperimentsView())

    def action_inbox(self) -> None:
        self._switch_view(InboxView())

    def action_archive(self) -> None:
        self._switch_view(ArchiveView())

    def action_pipeline(self) -> None:
        self._switch_view(PipelineView())

    def _switch_view(self, screen: Screen) -> None:
        """Switch to a different main view by replacing the current screen."""
        # Pop current screen if it's a main view (not a modal)
        try:
            self.pop_screen()
        except Exception:
            pass
        self.push_screen(screen)


def main():
    """Run the TUI application."""
    app = DashboardTUI()
    app.run()


if __name__ == "__main__":
    main()
