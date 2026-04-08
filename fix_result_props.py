import re

with open('test/unit/llm/provider-adapters.test.ts', 'r') as f:
    content = f.read()

# Fix result.content -> result.value.content (when not already fixed)
# But careful: result.error.message should stay as is
content = re.sub(
    r'expect\(result\.(content|model|usage)\b([^)]*)\)',
    r'expect(result.value.\1\2)',
    content
)

# Fix remaining result.content without expect() - in variable assignments etc
# This is trickier - need to be careful not to break result.error.message
lines = content.split('\n')
new_lines = []
for line in lines:
    # Skip lines that already have result.value or result.error
    if 'result.value.' in line or 'result.error.message' in line:
        new_lines.append(line)
        continue
    
    # Fix result.content that isn't preceded by value or error
    if 'result.content' in line and 'result.error' not in line:
        line = line.replace('result.content', 'result.value.content')
    if 'result.model' in line and 'result.error' not in line:
        line = line.replace('result.model', 'result.value.model')
    if 'result.usage' in line and 'result.error' not in line:
        line = line.replace('result.usage', 'result.value.usage')
    
    new_lines.append(line)

content = '\n'.join(new_lines)

with open('test/unit/llm/provider-adapters.test.ts', 'w') as f:
    f.write(content)

print("Fixed result property accesses")
