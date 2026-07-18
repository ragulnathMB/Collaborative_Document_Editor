from pathlib import Path
import os

# Files and folders to ignore
IGNORE_DIRS = {
    "node_modules",
    ".git",
    ".venv",
    "venv",
    "__pycache__",
    "dist",
    "build",
    ".idea",
    ".vscode",
}

IGNORE_FILES = {
    "generate_project_doc.py",
    "package-lock.json",
    "yarn.lock",
    "pnpm-lock.yaml",
}

# File extensions that are usually safe to include as code
CODE_EXTENSIONS = {
    ".py",
    ".js",
    ".jsx",
    ".ts",
    ".tsx",
    ".java",
    ".cpp",
    ".c",
    ".h",
    ".hpp",
    ".cs",
    ".go",
    ".rs",
    ".php",
    ".rb",
    ".swift",
    ".kt",
    ".html",
    ".css",
    ".scss",
    ".sass",
    ".json",
    ".xml",
    ".yaml",
    ".yml",
    ".md",
    ".txt",
    ".sql",
    ".sh",
    ".bat",
    ".env",
    ".gitignore",
    ".dockerfile",
}

OUTPUT_FILE = "PROJECT_DOCUMENTATION.md"


def get_language(file_path):
    extension = file_path.suffix.lower()

    languages = {
        ".py": "python",
        ".js": "javascript",
        ".jsx": "jsx",
        ".ts": "typescript",
        ".tsx": "tsx",
        ".java": "java",
        ".cpp": "cpp",
        ".c": "c",
        ".h": "c",
        ".hpp": "cpp",
        ".cs": "csharp",
        ".go": "go",
        ".rs": "rust",
        ".php": "php",
        ".rb": "ruby",
        ".swift": "swift",
        ".kt": "kotlin",
        ".html": "html",
        ".css": "css",
        ".scss": "scss",
        ".json": "json",
        ".xml": "xml",
        ".yaml": "yaml",
        ".yml": "yaml",
        ".sql": "sql",
        ".sh": "bash",
        ".bat": "bat",
        ".md": "markdown",
        ".txt": "text",
    }

    return languages.get(extension, "text")


def create_project_tree(root_path):
    tree_lines = []

    def walk(directory, prefix=""):
        try:
            items = sorted(
                [
                    item
                    for item in directory.iterdir()
                    if item.name not in IGNORE_DIRS
                    and item.name not in IGNORE_FILES
                ],
                key=lambda x: (x.is_file(), x.name.lower()),
            )
        except PermissionError:
            return

        for index, item in enumerate(items):
            is_last = index == len(items) - 1

            connector = "└── " if is_last else "├── "
            tree_lines.append(f"{prefix}{connector}{item.name}")

            if item.is_dir():
                new_prefix = prefix + ("    " if is_last else "│   ")
                walk(item, new_prefix)

    tree_lines.append(root_path.name)
    walk(root_path)

    return "\n".join(tree_lines)


def collect_files(root_path):
    files = []

    for path in root_path.rglob("*"):
        if not path.is_file():
            continue

        # Skip ignored directories
        if any(part in IGNORE_DIRS for part in path.parts):
            continue

        # Skip ignored files
        if path.name in IGNORE_FILES:
            continue

        # Skip generated documentation file
        if path.name == OUTPUT_FILE:
            continue

        # Only include recognized code/text files
        if path.suffix.lower() in CODE_EXTENSIONS or path.name in {
            "Dockerfile",
            ".gitignore",
            ".env",
        }:
            files.append(path)

    return sorted(files)


def read_file(file_path):
    try:
        return file_path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        return "[Binary or non-UTF-8 file skipped]"
    except Exception as error:
        return f"[Could not read file: {error}]"


def generate_documentation():
    root_path = Path(__file__).parent.resolve()

    print("Scanning project...")

    project_tree = create_project_tree(root_path)
    project_files = collect_files(root_path)

    markdown = []

    # Title
    markdown.append(f"# {root_path.name} - Project Documentation\n")

    # Project tree
    markdown.append("## 📁 Project Structure\n")
    markdown.append("```text")
    markdown.append(project_tree)
    markdown.append("```\n")

    # File contents
    markdown.append("## 📄 Source Code\n")

    for file_path in project_files:
        relative_path = file_path.relative_to(root_path)
        code = read_file(file_path)
        language = get_language(file_path)

        markdown.append(f"### `{relative_path}`\n")
        markdown.append(f"```{language}")
        markdown.append(code)
        markdown.append("```\n")

    output_path = root_path / OUTPUT_FILE
    output_path.write_text("\n".join(markdown), encoding="utf-8")

    print(f"\n✅ Documentation generated successfully!")
    print(f"📄 File: {OUTPUT_FILE}")
    print(f"📊 Files included: {len(project_files)}")


if __name__ == "__main__":
    generate_documentation()
