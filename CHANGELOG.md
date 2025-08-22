# Changelog - Spring Boot MCP Server

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.3] - 2025-08-22

### Improved
- Universal MCP compatibility - Added clear messaging that server works with ANY MCP client, not just Claude Desktop
- Professional presentation - Updated docs/index.html with modern SVG iconography
- Comprehensive documentation update - Synchronized all README files (main, EN, FR) with consistent messaging
- Enhanced examples - Updated EXAMPLES.md with universal MCP client compatibility information

### Added
- Universal compatibility banner - Prominent messaging about MCP client compatibility in documentation
- Version badge - v1.2.2 version indicator in web documentation

### Technical
- Web presentation - Modern, professional appearance for GitHub Pages documentation
- Multi-language support - Consistent updates across English and French documentation

## [1.2.2] - 2025-08-21

### Added
- Enhanced MCP server functionality - Complete implementation with 7 specialized tools
- npx installation support - Recommended installation method with always-latest version
- JetBrains IDE integration - Setup scripts for IntelliJ IDEA, WebStorm, PyCharm, etc.
- Comprehensive testing suite - Automated testing for all MCP tools

### Improved
- Installation flexibility - Multiple installation options (npx, global, local)
- Documentation structure - Enhanced README with detailed examples and workflows
- Error handling - Robust error management and user feedback

## [1.1.0] - 2025-08-21

### Added
- Complete spring.io/projects support - Access to all Spring projects (Security, Data, Cloud, etc.)
- New search_spring_projects tool - Search among all available Spring projects
- New get_spring_project tool - Retrieve complete details of a specific Spring project
- New get_all_spring_guides tool - List all Spring guides with category filtering
- Extended knowledge base - Popular Spring projects integrated for robust fallback
- Enhanced documentation - Practical examples guide (EXAMPLES.md)
- Contribution guide - Developer documentation (CONTRIBUTING.md)

### Improved
- Expanded documentation coverage - From 4 to 7 MCP tools
- Service robustness - Fallback mechanisms for popular projects and guides
- Query performance - Optimized HTML parsing and Markdown conversion
- Extended testing - Updated test script with all new tools

### Documentation Sources Added
- https://spring.io/projects - Complete catalog of Spring projects
- https://spring.io/guides - Extended collection of practical guides
- Popular projects knowledge base (Boot, Security, Data, Cloud, etc.)

### MCP Tools (7 total)
1. search_spring_docs - Search Spring Boot documentation (existing)
2. search_spring_projects - NEW - Search Spring projects
3. get_spring_project - NEW - Spring project details
4. get_all_spring_guides - NEW - List Spring guides
5. get_spring_guide - Retrieve specific guide (existing)
6. get_spring_reference - Reference documentation (existing)
7. search_spring_concepts - Search concepts (existing)

## [1.0.0] - 2025-08-21

### Initial Release
- Functional MCP server - Complete Model Context Protocol implementation
- 4 basic tools - Access to essential Spring Boot documentation
- TypeScript architecture - Modern code with strict types
- Claude Desktop configuration - Ready-to-use integration
- Automated testing - Functionality validation script
- Complete documentation - README with installation and usage instructions

### Basic MCP Tools
1. search_spring_docs - Search Spring Boot documentation
2. get_spring_guide - Retrieve specific guide
3. get_spring_reference - Reference documentation
4. search_spring_concepts - Search Spring Boot concepts

### Initial Documentation Sources
- Official Spring Boot documentation
- Selected Spring.io guides
- Spring Boot concepts knowledge base

### Technical Features
- stdio transport for MCP communication
- HTML parsing with Cheerio
- Markdown conversion with Turndown
- Robust error handling
- JSON-RPC 2.0 request support

---

## Version Format

- **MAJOR**: Incompatible API changes
- **MINOR**: Backward-compatible new features
- **PATCH**: Backward-compatible bug fixes

## Types of Changes

- **Added** for new features
- **Improved** for changes to existing functionality
- **Fixed** for bug fixes
- **Removed** for removed features
- **Deprecated** for soon-to-be removed features
- **Security** for vulnerability fixes
