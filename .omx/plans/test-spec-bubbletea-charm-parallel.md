# Test Spec: Bubble Tea Charm Operator Surface Parallel Implementation

## Verification goals
- New Bubble Tea input/operator behaviors fail first under test, then pass.
- Full bubbletea Go suite remains green.
- Visual/operator copy changes are documented.

## Required checks
1. Focus/input tests for new multiline input behavior
2. Operator surface rendering tests for any new cards/panels/copy
3. Layout stability / resize safety remains intact
4. `cd bubbletea && go test ./... -count=1`

## Stretch checks
- additional targeted tests for list/table/operator selection if introduced
- manual `npm run tui` smoke after parallel slices merge cleanly
