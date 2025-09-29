import fetch from 'node-fetch';
import { CacheService } from './cache.js';

/**
 * Advanced features service for Spring documentation
 */
export class AdvancedFeaturesService {
  private cache: CacheService;

  constructor() {
    this.cache = new CacheService();
  }

  /**
   * Search across the entire Spring ecosystem
   */
  async searchEcosystem(query: string, scope: string = 'all', limit: number = 5) {
    const cacheKey = `ecosystem:${query}:${scope}:${limit}`;
    const cached = this.cache.get<any>(cacheKey);
    if (cached) return cached;

    const results: any = {
      query,
      scope,
      totalResults: 0,
      categories: {}
    };

    try {
      if (scope === 'all' || scope === 'projects') {
        results.categories.projects = await this.searchProjects(query, limit);
      }

      if (scope === 'all' || scope === 'guides') {
        results.categories.guides = await this.searchGuides(query, limit);
      }

      if (scope === 'all' || scope === 'docs') {
        results.categories.documentation = await this.searchDocumentation(query, limit);
      }

      if (scope === 'all' || scope === 'api') {
        results.categories.api = await this.searchAPI(query, limit);
      }

      results.totalResults = Object.values(results.categories)
        .reduce((total: number, category: any) => total + (category?.length || 0), 0);

      this.cache.set(cacheKey, results);
      return results;

    } catch (error) {
      console.error('Error in ecosystem search:', error);
      throw new Error('Failed to search Spring ecosystem');
    }
  }

  /**
   * Get step-by-step tutorials
   */
  async getTutorial(topic: string, level: string = 'beginner') {
    const cacheKey = `tutorial:${topic}:${level}`;
    const cached = this.cache.get<string>(cacheKey);
    if (cached) return cached;

    const tutorials = this.getTutorialDatabase();
    const tutorial = tutorials[topic]?.[level];

    if (!tutorial) {
      const availableTopics = Object.keys(tutorials).join(', ');
      return `# Tutorial Not Found

The tutorial for "${topic}" at "${level}" level is not available.

## Available Topics:
${availableTopics}

## Available Levels:
- beginner
- intermediate
- advanced

Please use one of the available topics and levels.`;
    }

    this.cache.setLongTerm(cacheKey, tutorial);
    return tutorial;
  }

  /**
   * Compare Spring Boot versions
   */
  async compareVersions(version1: string, version2: string, focus: string = 'all') {
    const cacheKey = `compare:${version1}:${version2}:${focus}`;
    const cached = this.cache.get<string>(cacheKey);
    if (cached) return cached;

    try {
      const comparison = await this.generateVersionComparison(version1, version2, focus);
      this.cache.setLongTerm(cacheKey, comparison);
      return comparison;
    } catch (error) {
      console.error('Error comparing versions:', error);
      throw new Error(`Failed to compare Spring Boot versions ${version1} and ${version2}`);
    }
  }

  /**
   * Get best practices
   */
  async getBestPractices(category: string, experienceLevel: string = 'intermediate') {
    const cacheKey = `practices:${category}:${experienceLevel}`;
    const cached = this.cache.get<string>(cacheKey);
    if (cached) return cached;

    const practices = this.getBestPracticesDatabase();
    const categoryPractices = practices[category];

    if (!categoryPractices) {
      const availableCategories = Object.keys(practices).join(', ');
      return `# Best Practices Not Found

Best practices for "${category}" category are not available.

## Available Categories:
${availableCategories}

Please use one of the available categories.`;
    }

    const result = this.formatBestPractices(categoryPractices, category, experienceLevel);
    this.cache.setLongTerm(cacheKey, result);
    return result;
  }

  /**
   * Diagnose Spring issues
   */
  async diagnoseIssues(errorMessage: string, component?: string, stackTrace?: string) {
    const cacheKey = `diagnose:${this.hashString(errorMessage)}:${component || 'general'}`;
    const cached = this.cache.get<string>(cacheKey);
    if (cached) return cached;

    const diagnosis = this.performIssueDiagnosis(errorMessage, component, stackTrace);
    this.cache.set(cacheKey, diagnosis, 60 * 60 * 1000); // 1 hour cache
    return diagnosis;
  }

  // Private helper methods

  private async searchProjects(query: string, limit: number) {
    // Simplified project search - in real implementation, this would fetch from Spring.io
    const mockProjects = [
      { name: 'Spring Boot', description: 'Create stand-alone, production-grade Spring applications', url: 'https://spring.io/projects/spring-boot' },
      { name: 'Spring Security', description: 'Powerful and highly customizable security framework', url: 'https://spring.io/projects/spring-security' },
      { name: 'Spring Data', description: 'Consistent programming model for data access', url: 'https://spring.io/projects/spring-data' },
    ];

    return mockProjects
      .filter(p => p.name.toLowerCase().includes(query.toLowerCase()) ||
                   p.description.toLowerCase().includes(query.toLowerCase()))
      .slice(0, limit);
  }

  private async searchGuides(query: string, limit: number) {
    const mockGuides = [
      { title: 'Building a RESTful Web Service', url: 'https://spring.io/guides/gs/rest-service/', type: 'Getting Started' },
      { title: 'Accessing Data with JPA', url: 'https://spring.io/guides/gs/accessing-data-jpa/', type: 'Getting Started' },
      { title: 'Securing a Web Application', url: 'https://spring.io/guides/gs/securing-web/', type: 'Getting Started' },
    ];

    return mockGuides
      .filter(g => g.title.toLowerCase().includes(query.toLowerCase()))
      .slice(0, limit);
  }

  private async searchDocumentation(query: string, limit: number) {
    const mockDocs = [
      { title: 'Spring Boot Reference Documentation', url: 'https://docs.spring.io/spring-boot/docs/current/reference/', type: 'Reference' },
      { title: 'Spring Framework Documentation', url: 'https://docs.spring.io/spring-framework/docs/current/reference/', type: 'Reference' },
    ];

    return mockDocs
      .filter(d => d.title.toLowerCase().includes(query.toLowerCase()))
      .slice(0, limit);
  }

  private async searchAPI(query: string, limit: number) {
    const mockAPI = [
      { title: 'Spring Boot API Documentation', url: 'https://docs.spring.io/spring-boot/docs/current/api/', type: 'API' },
      { title: 'Spring Framework API', url: 'https://docs.spring.io/spring-framework/docs/current/javadoc-api/', type: 'API' },
    ];

    return mockAPI
      .filter(a => a.title.toLowerCase().includes(query.toLowerCase()))
      .slice(0, limit);
  }

  private getTutorialDatabase(): any {
    return {
      'rest-api': {
        beginner: `# Building Your First REST API with Spring Boot

## Prerequisites
- Java 11 or higher
- Basic understanding of Java
- Maven or Gradle

## Step 1: Create a New Spring Boot Project
\`\`\`bash
curl https://start.spring.io/starter.zip \\
  -d dependencies=web \\
  -d name=my-rest-api \\
  -d packageName=com.example.api \\
  -o my-rest-api.zip
\`\`\`

## Step 2: Create a Simple Controller
\`\`\`java
@RestController
@RequestMapping("/api")
public class HelloController {

    @GetMapping("/hello")
    public String hello() {
        return "Hello, World!";
    }

    @GetMapping("/hello/{name}")
    public String helloName(@PathVariable String name) {
        return "Hello, " + name + "!";
    }
}
\`\`\`

## Step 3: Run the Application
\`\`\`bash
./mvnw spring-boot:run
\`\`\`

## Step 4: Test Your API
\`\`\`bash
curl http://localhost:8080/api/hello
curl http://localhost:8080/api/hello/John
\`\`\`

## Next Steps
- Add request/response DTOs
- Implement POST, PUT, DELETE methods
- Add input validation
- Handle exceptions properly`,

        intermediate: `# Advanced REST API Development with Spring Boot

## Data Transfer Objects (DTOs)
\`\`\`java
public class UserDto {
    @NotBlank
    private String name;

    @Email
    private String email;

    // getters and setters
}
\`\`\`

## Service Layer
\`\`\`java
@Service
public class UserService {

    @Autowired
    private UserRepository userRepository;

    public UserDto createUser(UserDto userDto) {
        User user = mapToEntity(userDto);
        User savedUser = userRepository.save(user);
        return mapToDto(savedUser);
    }
}
\`\`\`

## Exception Handling
\`\`\`java
@ControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(ValidationException.class)
    public ResponseEntity<ErrorResponse> handleValidation(ValidationException ex) {
        return ResponseEntity.badRequest()
            .body(new ErrorResponse("Validation failed", ex.getMessage()));
    }
}
\`\`\`

## Testing
\`\`\`java
@SpringBootTest
@AutoConfigureTestDatabase
class UserControllerTest {

    @Autowired
    private TestRestTemplate restTemplate;

    @Test
    void shouldCreateUser() {
        UserDto user = new UserDto("John", "john@example.com");
        ResponseEntity<UserDto> response = restTemplate.postForEntity(
            "/api/users", user, UserDto.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
    }
}
\`\`\``,

        advanced: `# Production-Ready REST API with Spring Boot

## Advanced Features Implementation

### 1. API Versioning
\`\`\`java
@RestController
@RequestMapping("/api/v1/users")
public class UserControllerV1 {
    // Version 1 implementation
}

@RestController
@RequestMapping("/api/v2/users")
public class UserControllerV2 {
    // Version 2 with breaking changes
}
\`\`\`

### 2. HATEOAS Implementation
\`\`\`java
@GetMapping("/{id}")
public EntityModel<UserDto> getUser(@PathVariable Long id) {
    UserDto user = userService.findById(id);
    return EntityModel.of(user)
        .add(linkTo(methodOn(UserController.class).getUser(id)).withSelfRel())
        .add(linkTo(UserController.class).withRel("users"));
}
\`\`\`

### 3. Advanced Security
\`\`\`java
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http.oauth2ResourceServer(oauth2 -> oauth2.jwt(withDefaults()))
            .authorizeHttpRequests(authz -> authz
                .requestMatchers("/api/public/**").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/users").hasRole("USER")
                .requestMatchers("/api/admin/**").hasRole("ADMIN")
                .anyRequest().authenticated()
            );
        return http.build();
    }
}
\`\`\`

### 4. Metrics and Monitoring
\`\`\`java
@Component
public class ApiMetrics {

    private final MeterRegistry meterRegistry;
    private final Counter apiCallCounter;

    public ApiMetrics(MeterRegistry meterRegistry) {
        this.meterRegistry = meterRegistry;
        this.apiCallCounter = Counter.builder("api.calls")
            .description("Number of API calls")
            .register(meterRegistry);
    }
}
\`\`\`

### 5. Rate Limiting
\`\`\`java
@Component
public class RateLimitingFilter implements Filter {

    private final RedisTemplate<String, String> redisTemplate;

    @Override
    public void doFilter(ServletRequest request, ServletResponse response,
                        FilterChain chain) throws IOException, ServletException {

        String clientId = getClientId(request);
        if (isRateLimited(clientId)) {
            ((HttpServletResponse) response).setStatus(429);
            return;
        }

        chain.doFilter(request, response);
    }
}
\`\`\``
      },
      // Add more tutorials for other topics
    };
  }

  private async generateVersionComparison(version1: string, version2: string, focus: string): Promise<string> {
    // This would fetch actual version data in a real implementation
    return `# Spring Boot Version Comparison: ${version1} vs ${version2}

## Overview
Comparing Spring Boot ${version1} with ${version2}

## Major Changes
${focus === 'all' || focus === 'breaking-changes' ? `
### Breaking Changes
- Java version requirements updated
- Configuration property changes
- Deprecated APIs removed
` : ''}

${focus === 'all' || focus === 'new-features' ? `
### New Features
- Enhanced auto-configuration
- New starters available
- Improved monitoring capabilities
` : ''}

${focus === 'all' || focus === 'deprecations' ? `
### Deprecations
- Legacy configuration support
- Outdated dependencies
- Old API patterns
` : ''}

## Migration Guide
1. Update Java version if required
2. Update dependency versions
3. Review configuration changes
4. Test thoroughly

## Recommendation
${this.getUpgradeRecommendation(version1, version2)}`;
  }

  private getBestPracticesDatabase(): any {
    return {
      architecture: {
        title: 'Spring Boot Architecture Best Practices',
        practices: [
          {
            title: 'Layer Separation',
            description: 'Maintain clear separation between presentation, business, and data layers',
            examples: ['Controller → Service → Repository pattern', 'Use DTOs for data transfer'],
            level: ['beginner', 'intermediate', 'expert']
          },
          {
            title: 'Dependency Injection',
            description: 'Use constructor injection and avoid field injection',
            examples: ['@Autowired on constructors', 'Final fields for dependencies'],
            level: ['intermediate', 'expert']
          }
        ]
      },
      performance: {
        title: 'Performance Optimization',
        practices: [
          {
            title: 'Lazy Loading',
            description: 'Use lazy loading for JPA relationships',
            examples: ['@OneToMany(fetch = FetchType.LAZY)', 'Use @EntityGraph for specific queries'],
            level: ['intermediate', 'expert']
          },
          {
            title: 'Connection Pooling',
            description: 'Configure proper database connection pooling',
            examples: ['HikariCP configuration', 'Monitor connection usage'],
            level: ['expert']
          }
        ]
      }
      // Add more categories...
    };
  }

  private formatBestPractices(practices: any, category: string, level: string): string {
    const filtered = practices.practices.filter((p: any) => p.level.includes(level));

    let result = `# ${practices.title}\n\n`;
    result += `**Experience Level:** ${level}\n\n`;

    filtered.forEach((practice: any, index: number) => {
      result += `## ${index + 1}. ${practice.title}\n\n`;
      result += `${practice.description}\n\n`;
      result += `**Examples:**\n`;
      practice.examples.forEach((example: string) => {
        result += `- ${example}\n`;
      });
      result += '\n';
    });

    return result;
  }

  private performIssueDiagnosis(errorMessage: string, component?: string, stackTrace?: string): string {
    const commonIssues = {
      'Port 8080 was already in use': {
        cause: 'Another application is using the default Spring Boot port',
        solutions: [
          'Change port in application.properties: server.port=8081',
          'Kill the process using port 8080',
          'Use a different port for your application'
        ]
      },
      'Failed to configure a DataSource': {
        cause: 'Database configuration is missing or incorrect',
        solutions: [
          'Add database dependency to pom.xml/build.gradle',
          'Configure datasource properties in application.properties',
          'Use @SpringBootApplication(exclude = {DataSourceAutoConfiguration.class}) if no database needed'
        ]
      },
      'NoSuchBeanDefinitionException': {
        cause: 'Required bean is not found in the application context',
        solutions: [
          'Check if the class is annotated with @Component, @Service, @Repository, or @Controller',
          'Ensure the class is in a package scanned by @ComponentScan',
          'Verify @Autowired dependencies are correctly configured'
        ]
      }
    };

    for (const [pattern, issue] of Object.entries(commonIssues)) {
      if (errorMessage.includes(pattern)) {
        return `# Spring Boot Issue Diagnosis

## Error Analysis
**Error:** ${errorMessage}
${component ? `**Component:** ${component}` : ''}

## Root Cause
${issue.cause}

## Recommended Solutions
${issue.solutions.map((solution, index) => `${index + 1}. ${solution}`).join('\n')}

${stackTrace ? `
## Stack Trace Analysis
The provided stack trace shows:
\`\`\`
${stackTrace.substring(0, 500)}${stackTrace.length > 500 ? '...' : ''}
\`\`\`
` : ''}

## Additional Resources
- [Spring Boot Documentation](https://docs.spring.io/spring-boot/docs/current/reference/html/)
- [Common Application Properties](https://docs.spring.io/spring-boot/docs/current/reference/html/application-properties.html)`;
      }
    }

    return `# Spring Boot Issue Diagnosis

## Error Analysis
**Error:** ${errorMessage}
${component ? `**Component:** ${component}` : ''}

## Diagnosis
This appears to be a custom or less common error. Here are general troubleshooting steps:

1. **Check Logs:** Review the full stack trace for more context
2. **Verify Configuration:** Ensure all properties are correctly set
3. **Dependencies:** Check if all required dependencies are included
4. **Version Compatibility:** Verify Spring Boot and dependency versions are compatible

## Recommended Actions
1. Enable debug logging: \`logging.level.org.springframework=DEBUG\`
2. Check Spring Boot documentation for the specific component
3. Search Spring Boot GitHub issues for similar problems
4. Consider posting on Stack Overflow with the full stack trace

${stackTrace ? `
## Stack Trace Analysis
\`\`\`
${stackTrace.substring(0, 500)}${stackTrace.length > 500 ? '...' : ''}
\`\`\`
` : ''}`;
  }

  private getUpgradeRecommendation(version1: string, version2: string): string {
    // Simplified version comparison logic
    const v1Major = parseInt(version1.split('.')[0]);
    const v2Major = parseInt(version2.split('.')[0]);

    if (v2Major > v1Major) {
      return `🚨 Major version upgrade detected. This may include breaking changes. Plan for thorough testing and potential code modifications.`;
    } else {
      return `✅ Minor/patch version upgrade. Generally safe to upgrade with minimal breaking changes expected.`;
    }
  }

  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString();
  }
}