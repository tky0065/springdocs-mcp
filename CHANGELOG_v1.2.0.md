# 🆕 Changelog - Version 1.2.0

## [1.2.0] - 2025-08-21

### ✨ Added - JetBrains IDEs Support

- **🛠️ JetBrains IDEs Integration**: Full support for all JetBrains IDEs
  - IntelliJ IDEA (Ultimate & Community)
  - WebStorm
  - PyCharm (Professional & Community)
  - PhpStorm, RubyMine, CLion, GoLand, Rider, DataGrip
  - Android Studio

- **🚀 Automatic Configuration Script**: `setup-jetbrains.sh`
  - Detects all installed JetBrains IDEs
  - Creates appropriate configuration files
  - Works on macOS, Linux, and Windows
  - Color-coded output and progress indicators

- **📚 JetBrains Documentation**: New `JETBRAINS_SETUP.md`
  - Complete setup instructions
  - IDE-specific configurations
  - Usage examples and troubleshooting
  - Manual and automatic setup options

- **🔧 Enhanced Scripts**:
  - `npm run setup-jetbrains` - Configure JetBrains IDEs
  - `npm run setup-all` - Configure all supported IDEs

### 🔄 Improved

- **📖 Enhanced README**: Added JetBrains configuration section
- **⚙️ VS Code Settings**: Updated `.vscode/settings.json` with MCP configuration
- **🛠️ Troubleshooting Guide**: Updated `TROUBLESHOOTING.md` with JetBrains support

### 🎯 Use Cases

Now developers can use the Spring Documentation MCP Server in:
- **Claude Desktop** - Chat interface
- **VS Code** - With Claude extension
- **JetBrains IDEs** - Integrated AI assistance
- **Command Line** - Direct MCP server access

### 🔧 Technical Details

- Cross-platform configuration detection
- IDE version-specific setup
- XML and JSON configuration formats
- Automatic path resolution for different OS

---

## Previous Versions

### [1.1.1] - 2025-08-21
- 📝 Documentation internationalization (English)
- 🌍 Public distribution preparation

### [1.1.0] - 2025-08-21
- ✨ Extended to complete Spring ecosystem
- 🆕 Added 3 new MCP tools (total: 7 tools)
- 🌐 Spring.io/projects integration

### [1.0.0] - 2025-08-21
- 🎉 Initial release
- 📚 Basic Spring Boot documentation access
- 🛠️ 4 core MCP tools

---

**Full Changelog**: https://github.com/tky0065/springdocs-mcp/compare/v1.1.1...v1.2.0
