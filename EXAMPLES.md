# Usage Examples - Spring Documentation MCP Server

This file contains practical usage examples for the Spring Documentation MCP Server with Claude Desktop.

## 🚀 Usage Scenarios

### 1. Discovering Spring Projects

**Question to Claude:**
> "What Spring projects are available for security?"

**Tools used:** `search_spring_projects`
**Result:** List of Spring Security projects with descriptions

---

### 2. Learning a New Spring Project

**Question to Claude:**
> "Can you explain the Spring Cloud project?"

**Tools used:** `get_spring_project`
**Result:** Complete Spring Cloud documentation

---

### 3. Exploring Guides by Domain

**Question to Claude:**
> "Show me all Spring Boot guides for web development"

**Tools used:** `get_all_spring_guides`
**Result:** List of web guides with links and descriptions

---

### 4. Solving a Specific Problem

**Question to Claude:**
> "How do I create a REST API with Spring Boot?"

**Tools used:** `search_spring_docs`, `get_spring_guide`
**Result:** Detailed guide and reference documentation

---

### 5. Understanding Concepts

**Question to Claude:**
> "Explain Spring Boot auto-configuration to me"

**Tools used:** `search_spring_concepts`
**Result:** Detailed explanation with examples

---

## 🎯 Specific Query Examples

### Documentation Search
```
User: "How to configure Spring Security?"
Claude uses: search_spring_docs("Spring Security configuration")
```

### Project Exploration
```
User: "What are the Spring projects for data?"
Claude uses: search_spring_projects("data")
```

### Specialized Guides
```
User: "Spring Boot guides for testing"
Claude uses: get_all_spring_guides(category="Testing")
```

### Reference Documentation
```
User: "Spring Boot documentation for web security"
Claude uses: get_spring_reference("security", "web")
```

### Advanced Concepts
```
User: "What is Spring Actuator?"
Claude uses: search_spring_concepts("actuator", "production")
```

---

## 💡 Optimal Usage Tips

### 1. Be Specific in Your Questions
- ❌ "Spring Boot"
- ✅ "How to configure a database with Spring Boot?"

### 2. Use Relevant Keywords
- ❌ "Help"
- ✅ "REST API", "JPA", "Security", "Testing"

### 3. Explore by Domain
- "Spring projects for cloud"
- "Spring Boot guides for microservices"
- "Spring Security documentation"

### 4. Ask for Practical Examples
- "Show me an example of a REST controller"
- "How to test a Spring Boot application?"
- "H2 database configuration"

---

## 🔧 Recommended Workflows

### Workflow 1: Discovering a New Domain
1. **Search projects** → `search_spring_projects("domain")`
2. **Explore a project** → `get_spring_project("project-name")`
3. **Find guides** → `get_all_spring_guides(category="Domain")`
4. **Read a specific guide** → `get_spring_guide("guide-id")`

### Workflow 2: Problem Solving
1. **Search documentation** → `search_spring_docs("problem")`
2. **Understand concepts** → `search_spring_concepts("concept")`
3. **Consult reference** → `get_spring_reference("section")`
4. **Follow practical guide** → `get_spring_guide("guide-id")`

### Workflow 3: Structured Learning
1. **Basic concepts** → `search_spring_concepts("core")`
2. **Beginner guides** → `get_all_spring_guides(category="Getting Started")`
3. **Reference documentation** → `get_spring_reference("web")`
4. **Advanced projects** → `search_spring_projects("advanced")`

---

## 🌟 Advanced Use Cases

### Developing a Complete REST API
```
1. "What are the guides for creating a REST API?"
2. "Show me the guide for creating a REST service"
3. "How to secure a REST API with Spring Security?"
4. "Documentation on REST API testing"
5. "Production concepts for REST APIs"
```

### Migration to Spring Boot 3
```
1. "What Spring projects are compatible with Boot 3?"
2. "Spring Boot 2 to 3 migration guide"
3. "Spring Boot 3 new features"
4. "Spring Boot 3 reference documentation"
```

### Microservices Architecture
```
1. "Spring projects for microservices"
2. "Spring Cloud guides"
3. "Distributed configuration concepts"
4. "Spring Cloud Gateway documentation"
```

---

## 📖 Expected Response Types

### Search Results (search_*)
- Resource titles
- Short descriptions
- Direct URLs
- Content types

### Detailed Content (get_*)
- Complete documentation in Markdown
- Code examples
- Configuration
- Best practices

### Concepts (search_spring_concepts)
- Clear definitions
- Concrete examples
- Associated keywords
- Use cases

---

*This MCP server gives you access to the entire Spring ecosystem directly in Claude Desktop!*
