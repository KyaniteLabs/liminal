export function generateCompletions(shell: string): string {
  const flags = "--prompt -p --max-iterations -m --output -o --provider --model --configure --recent --favorite --favorites --interactive -i --mode --use-swarm --swarm-mode --swarm-rounds --help -h --version";
  if (shell === "zsh") return "#compdef liminal\n# Flags: " + flags + "\n_liminal() { compdef _liminal liminal }";
  if (shell === "bash") return "# Flags: " + flags + "\n_liminal() { complete -F _liminal liminal }";
  return "";
}
