import re

with open('test/unit/llm/provider-adapters.test.ts', 'r') as f:
    lines = f.readlines()

# Process line by line
new_lines = []
i = 0
while i < len(lines):
    line = lines[i]
    
    # Check if this line has result.success
    if 'expect(result.success).toBe(false);' in line:
        # Check context - look at previous lines to determine the pattern
        prev_lines = ''.join(lines[max(0,i-15):i])
        
        # If mockFetchResponse has false at the end (API error)
        if ', false);' in prev_lines and 'mockFetchResponse' in prev_lines:
            # Check if this is an error case (status code check)
            if i+1 < len(lines) and ("error" in lines[i+1] or "content" in lines[i+1]):
                # Replace with isErr pattern
                indent = len(line) - len(line.lstrip())
                spaces = ' ' * indent
                new_lines.append(f"{spaces}expect(result.isErr()).toBe(true);\n")
                # Fix next line if it has result.error
                if i+1 < len(lines) and 'result.error' in lines[i+1]:
                    error_line = lines[i+1]
                    new_error = error_line.replace('result.error)', 'result.error.message)')
                    new_lines.append(new_error)
                    i += 2
                    continue
            else:
                new_lines.append(line)
        else:
            # Empty content case - isOk + value.success
            indent = len(line) - len(line.lstrip())
            spaces = ' ' * indent
            new_lines.append(f"{spaces}expect(result.isOk()).toBe(true);\n")
            new_lines.append(f"{spaces}expect(result.value.success).toBe(false);\n")
            # Fix next line if it checks result.content
            if i+1 < len(lines) and 'result.content' in lines[i+1]:
                content_line = lines[i+1]
                new_content = content_line.replace('result.content)', 'result.value.content)')
                new_lines.append(new_content)
                i += 2
                continue
    else:
        new_lines.append(line)
    
    i += 1

with open('test/unit/llm/provider-adapters.test.ts', 'w') as f:
    f.writelines(new_lines)

print("Fixed remaining patterns")
