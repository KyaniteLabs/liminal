import re

with open('test/unit/llm/OllamaProvider.test.ts', 'r') as f:
    content = f.read()

# Fix result.success patterns
# For success=true: change to isOk + value.success
content = re.sub(
    r"expect\(result\.success\)\.toBe\(true\);",
    "expect(result.isOk()).toBe(true);\n    expect(result.value.success).toBe(true);",
    content
)

# For success=false in error cases: check if there's an error message pattern
# These should become isErr checks
lines = content.split('\n')
new_lines = []
i = 0
while i < len(lines):
    line = lines[i]
    
    if 'expect(result.success).toBe(false);' in line:
        # Check context for whether this is an API error or empty content
        prev_context = ''.join(lines[max(0, i-10):i+1])
        
        # If there's a mockFetchResponse with false, it's an API error
        if ', false);' in prev_context and 'mockFetchResponse' in prev_context:
            indent = len(line) - len(line.lstrip())
            spaces = ' ' * indent
            new_lines.append(f"{spaces}expect(result.isErr()).toBe(true);\n")
            # Check next line for result.error and fix it
            if i+1 < len(lines) and 'result.error' in lines[i+1] and 'error.message' not in lines[i+1]:
                error_line = lines[i+1]
                # Change result.error to result.error.message
                error_line = re.sub(r'result\.error\)', 'result.error.message)', error_line)
                new_lines.append(error_line)
                i += 2
                continue
        else:
            # Empty content case - isOk + value.success
            indent = len(line) - len(line.lstrip())
            spaces = ' ' * indent
            new_lines.append(f"{spaces}expect(result.isOk()).toBe(true);\n")
            new_lines.append(f"{spaces}expect(result.value.success).toBe(false);\n")
            # Check next line for result.content and fix it
            if i+1 < len(lines) and 'result.content' in lines[i+1] and 'value.content' not in lines[i+1]:
                content_line = lines[i+1]
                content_line = content_line.replace('result.content)', 'result.value.content)')
                new_lines.append(content_line)
                i += 2
                continue
    else:
        new_lines.append(line)
    
    i += 1

content = '\n'.join(new_lines)

# Fix result.content, result.model, result.usage, result.thinking for Ok cases
# But not in error checking contexts
lines = content.split('\n')
new_lines = []
for line in lines:
    # Skip if already fixed or in error context
    if 'result.value.' in line or 'result.error' in line:
        new_lines.append(line)
        continue
    
    # Fix result.property patterns
    if 'result.content' in line:
        line = line.replace('result.content)', 'result.value.content)')
    if 'result.model' in line:
        line = line.replace('result.model)', 'result.value.model)')
    if 'result.usage' in line:
        line = line.replace('result.usage)', 'result.value.usage)')
    if 'result.thinking' in line:
        line = line.replace('result.thinking)', 'result.value.thinking)')
    
    new_lines.append(line)

content = '\n'.join(new_lines)

with open('test/unit/llm/OllamaProvider.test.ts', 'w') as f:
    f.write(content)

print("Fixed OllamaProvider tests")
