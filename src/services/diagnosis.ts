/**
 * Local, deterministic and bounded analysis of Spring error messages and stack traces.
 *
 * The input is untrusted user text: every cap is applied BEFORE any processing, and the
 * parsing is line based (startsWith / indexOf / slice). No backtracking regex is used;
 * the only regexes are anchored, linear and without nested quantifiers.
 */

import { springProjectsConfig, SpringProjectsConfig } from './spring-projects-config.js';

export interface ExceptionLink {
  type: string;
  message: string;
}

export interface TraceAnalysis {
  chain: ExceptionLink[];
  top?: ExceptionLink;
  root?: ExceptionLink;
  /** Trimmed first application frame, e.g. "at com.acme.Foo.bar(Foo.java:42)" */
  applicationFrame?: string;
  /** One of startup | web | data | security | actuator | configuration */
  inferredComponent?: string;
}

export interface DiagnosisReference {
  project: string;
  section: string;
  subsection?: string;
}

export interface DiagnosisRule {
  id: string;
  needles: string[];
  title: string;
  checks: string[];
  references: DiagnosisReference[];
}

// ---------------------------------------------------------------------------
// Caps
// ---------------------------------------------------------------------------

const MAX_TRACE_LINES = 400;
const MAX_TRACE_CHARS = 20000;
const MAX_LINE_CHARS = 500;
const MAX_ERROR_MESSAGE_CHARS = 2000;
const MAX_LINK_MESSAGE_CHARS = 300;

const IDENTIFIER = /^[A-Za-z0-9_.$]+$/;
const EXCEPTION_SUFFIXES = ['Exception', 'Error', 'Throwable'];

/** Qualified-name prefixes of framework / JDK frames, skipped when looking for application code */
const FRAMEWORK_FRAME_PREFIXES = [
  'java.', 'javax.', 'jakarta.', 'jdk.', 'sun.', 'com.sun.', 'org.springframework.', 'org.apache.',
  'org.hibernate.', 'com.fasterxml.', 'io.netty.', 'reactor.', 'org.aspectj.', 'net.bytebuddy.',
  'org.junit.', 'org.eclipse.', 'org.jboss.', 'org.slf4j.', 'ch.qos.', 'com.zaxxer.',
];

/** Ordered (needle in frame name -> component) pairs for component inference */
const COMPONENT_HINTS: Array<[string, string]> = [
  ['org.springframework.security', 'security'],
  ['org.springframework.data', 'data'],
  ['org.hibernate', 'data'],
  ['jakarta.persistence', 'data'],
  ['javax.persistence', 'data'],
  ['org.springframework.jdbc', 'data'],
  ['org.springframework.orm', 'data'],
  ['org.springframework.boot.actuate', 'actuator'],
  ['org.springframework.web', 'web'],
  ['org.apache.catalina', 'web'],
  ['org.apache.tomcat', 'web'],
  ['com.fasterxml.jackson', 'web'],
  ['org.springframework.boot.context.properties', 'configuration'],
  ['org.springframework.boot.autoconfigure', 'configuration'],
  ['org.springframework.beans', 'startup'],
  ['org.springframework.context', 'startup'],
  ['org.springframework.boot.SpringApplication', 'startup'],
];

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

interface ParsedFrame {
  /** Trimmed "at ..." line */
  text: string;
  /** Qualified "class.method" name */
  name: string;
}

interface ParsedTrace {
  chain: ExceptionLink[];
  frames: ParsedFrame[];
}

/** Applies the size caps and returns the bounded, NUL-free lines of a trace. */
function boundedLines(stackTrace?: string): string[] {
  if (!stackTrace) return [];
  const text = stackTrace.slice(0, MAX_TRACE_CHARS).split('\0').join('');
  const lines: string[] = [];
  let start = 0;
  while (lines.length < MAX_TRACE_LINES && start <= text.length) {
    let end = text.indexOf('\n', start);
    if (end === -1) end = text.length;
    let line = text.slice(start, Math.min(end, start + MAX_LINE_CHARS + 1)); // +1 room for a trailing \r
    if (line.endsWith('\r')) line = line.slice(0, -1);
    lines.push(line.slice(0, MAX_LINE_CHARS).trim());
    start = end + 1;
  }
  return lines;
}

/** Parses "at pkg.Class.method(File.java:12)"; undefined when the line is not a well-formed frame. */
function parseFrame(line: string): ParsedFrame | undefined {
  if (!line.startsWith('at ')) return undefined;
  const open = line.indexOf('(');
  if (open < 0 || line.indexOf(')', open) < 0) return undefined;
  let name = line.slice(3, open).trim();
  // JDK 9+ frames may carry a module prefix: "java.base/java.util.List.get"
  const slash = name.lastIndexOf('/');
  if (slash >= 0) name = name.slice(slash + 1);
  if (name.length === 0 || !IDENTIFIER.test(name.replace(/<(init|clinit)>/, 'x'))) return undefined;
  return { text: line, name };
}

/** Parses an exception header line ("Caused by: x.YException: msg"); undefined when it is not one. */
function parseHeader(line: string): ExceptionLink | undefined {
  if (line.length === 0 || line.startsWith('at ') || line.startsWith('...')) return undefined;
  let rest = line;
  if (rest.startsWith('Caused by: ')) {
    rest = rest.slice('Caused by: '.length);
  } else if (rest.startsWith('Exception in thread "')) {
    const close = rest.indexOf('" ', 'Exception in thread "'.length);
    if (close < 0) return undefined;
    rest = rest.slice(close + 2);
  }
  rest = rest.trimStart();
  const colon = rest.indexOf(':');
  const type = (colon < 0 ? rest : rest.slice(0, colon)).trim();
  if (type.length === 0 || !IDENTIFIER.test(type)) return undefined;
  const lastDot = type.lastIndexOf('.');
  const simple = type.slice(lastDot + 1);
  if (!EXCEPTION_SUFFIXES.some((s) => simple.endsWith(s))) return undefined;
  const message = colon < 0 ? '' : rest.slice(colon + 1).trim().slice(0, MAX_LINK_MESSAGE_CHARS);
  return { type, message };
}

function parseTrace(stackTrace?: string): ParsedTrace {
  const chain: ExceptionLink[] = [];
  const frames: ParsedFrame[] = [];
  for (const line of boundedLines(stackTrace)) {
    const frame = parseFrame(line);
    if (frame) {
      frames.push(frame);
      continue;
    }
    const header = parseHeader(line);
    if (header) chain.push(header);
  }
  return { chain, frames };
}

function isFrameworkFrame(name: string): boolean {
  return FRAMEWORK_FRAME_PREFIXES.some((p) => name.startsWith(p));
}

function inferComponent(frames: ParsedFrame[]): string | undefined {
  for (const frame of frames) {
    for (const [needle, component] of COMPONENT_HINTS) {
      if (frame.name.includes(needle)) return component;
    }
  }
  return undefined;
}

export function analyzeStackTrace(stackTrace?: string): TraceAnalysis {
  const { chain, frames } = parseTrace(stackTrace);
  const analysis: TraceAnalysis = { chain };
  if (chain.length > 0) {
    analysis.top = chain[0];
    analysis.root = chain[chain.length - 1];
  }
  const appFrame = frames.find((f) => !isFrameworkFrame(f.name));
  if (appFrame) analysis.applicationFrame = appFrame.text;
  const inferred = inferComponent(frames);
  if (inferred) analysis.inferredComponent = inferred;
  return analysis;
}

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

export const DIAGNOSIS_RULES: DiagnosisRule[] = [
  {
    id: 'non-unique-bean',
    needles: ['nouniquebeandefinitionexception', 'expected single matching bean but found'],
    title: 'Several beans match the injection point',
    checks: [
      'mark one candidate `@Primary`',
      'select explicitly with `@Qualifier` or a matching parameter name',
      'inject `List<T>`/`Map<String, T>` to receive all candidates',
    ],
    references: [{ project: 'framework', section: 'core', subsection: 'beans' }],
  },
  {
    id: 'missing-bean',
    needles: ['nosuchbeandefinitionexception', 'no qualifying bean of type'],
    title: 'A required bean is missing',
    checks: [
      'the class is outside the `@SpringBootApplication` package or lacks `@Component`/`@Service`/`@Repository`',
      'the `@Bean` method or auto-configuration condition is not met (start with `--debug` to read the conditions report)',
      'a profile or `@ConditionalOn…` excludes it',
      'a starter dependency is missing',
    ],
    references: [
      { project: 'framework', section: 'core', subsection: 'beans' },
      { project: 'boot', section: 'using' },
    ],
  },
  {
    id: 'circular-dependency',
    needles: ['beancurrentlyincreationexception', 'form a cycle', 'circular dependency', 'circular reference'],
    title: 'Circular dependency between beans',
    checks: [
      'extract the shared logic into a third bean',
      'break the cycle with `@Lazy` on one injection point or setter injection',
      'Spring Boot 2.6+ forbids circular references by default — `spring.main.allow-circular-references=true` is a workaround, not a fix',
    ],
    references: [
      { project: 'framework', section: 'core', subsection: 'beans' },
      { project: 'boot', section: 'application-properties' },
    ],
  },
  {
    id: 'datasource',
    needles: ['failed to configure a datasource', 'cannot determine embedded database driver class'],
    title: 'No usable DataSource',
    checks: [
      'set `spring.datasource.url`, `username` and `password`',
      'add the JDBC driver (or an embedded database such as H2) to the classpath',
      'exclude `DataSourceAutoConfiguration` if the application needs no database',
    ],
    references: [
      { project: 'boot', section: 'data' },
      { project: 'boot', section: 'application-properties' },
    ],
  },
  {
    id: 'port-in-use',
    needles: ['was already in use', 'port already in use', 'address already in use'],
    title: 'The server port is already taken',
    checks: [
      'stop the process holding the port (for example `lsof -i :8080`)',
      'change `server.port`, or use `server.port=0` for a random port',
    ],
    references: [
      { project: 'boot', section: 'web' },
      { project: 'boot', section: 'application-properties' },
    ],
  },
  {
    id: 'config-binding',
    needles: ['configurationpropertiesbindexception', 'failed to bind properties', 'binding to target'],
    title: 'Configuration properties cannot be bound',
    checks: [
      'check the property name and value type (kebab-case is the canonical form)',
      'check `@Validated` constraints and required constructor-bound values',
      'read the "Action" hint printed with the failure',
    ],
    references: [
      { project: 'boot', section: 'features' },
      { project: 'boot', section: 'application-properties' },
    ],
  },
  {
    id: 'http-message-not-readable',
    needles: ['httpmessagenotreadableexception', 'json parse error', 'required request body is missing'],
    title: 'The request body cannot be read',
    checks: [
      'the JSON does not match the target type (types, enums, unknown properties)',
      'the `Content-Type` is not `application/json`',
      'an empty body is sent to a `@RequestBody` that is required',
    ],
    references: [
      { project: 'framework', section: 'web' },
      { project: 'boot', section: 'web' },
    ],
  },
  {
    id: 'lazy-initialization',
    needles: ['lazyinitializationexception', 'could not initialize proxy', 'no session'],
    title: 'A lazy association is accessed outside a session',
    checks: [
      'access the association inside a `@Transactional` boundary',
      'load it with a fetch join or `@EntityGraph`',
      'return a DTO projection instead of entities',
      'do not rely on open-in-view',
    ],
    references: [
      { project: 'data-jpa', section: 'jpa' },
      { project: 'boot', section: 'data' },
    ],
  },
  {
    id: 'no-transaction',
    needles: ['no entitymanager with actual transaction available', 'transactionrequiredexception'],
    title: 'A transaction is required',
    checks: [
      'annotate the service method with `@Transactional`',
      'calls must go through the Spring proxy (no self-invocation, not a private method)',
      'modifying queries need `@Modifying` and a transaction',
    ],
    references: [
      { project: 'data-jpa', section: 'jpa', subsection: 'transactions' },
      { project: 'framework', section: 'data-access' },
    ],
  },
  {
    id: 'classpath',
    needles: ['classnotfoundexception', 'noclassdeffounderror', 'nosuchmethoderror', 'nosuchfielderror', 'abstractmethoderror'],
    title: 'Missing class or incompatible library versions',
    checks: [
      'inspect the dependency tree (`mvn dependency:tree` or `gradle dependencies`)',
      "let Spring Boot's dependency management choose versions instead of overriding them",
      'do a clean build',
      'if the text mentions `javax.`, it may be the Jakarta migration — see `get_migration_guide` with version `3.0` and section `jakarta`',
    ],
    references: [{ project: 'boot', section: 'using' }],
  },
  {
    id: 'access-denied',
    needles: ['accessdeniedexception', 'invalid csrf token', 'could not verify the provided csrf token', 'forbidden'],
    title: 'Access denied by Spring Security',
    checks: [
      'state-changing requests need the CSRF token unless CSRF is deliberately disabled for a stateless API',
      'check the order of the `requestMatchers` rules',
      'roles need the `ROLE_` prefix as an authority and `hasRole` adds it for you',
    ],
    references: [
      { project: 'security', section: 'authorization' },
      { project: 'security', section: 'exploits' },
    ],
  },
  {
    id: 'unsatisfied-dependency',
    needles: ['unsatisfieddependencyexception'],
    title: 'Dependency injection failed',
    checks: [
      'this exception only wraps the real failure: read the root cause above',
      'typical causes are a missing or ambiguous bean, or a failing `@Bean` method',
    ],
    references: [{ project: 'framework', section: 'core', subsection: 'beans' }],
  },
  {
    id: 'bean-creation',
    needles: ['beancreationexception'],
    title: 'A bean could not be created',
    checks: [
      'the exception wraps the cause: read the root cause above',
      'check the constructor, `@PostConstruct` and the `@Bean` method for failures',
    ],
    references: [{ project: 'framework', section: 'core', subsection: 'beans' }],
  },
];

/** References appended per component, after those of the matched rules */
const COMPONENT_REFERENCES: Record<string, DiagnosisReference[]> = {
  startup: [{ project: 'boot', section: 'using' }],
  web: [{ project: 'boot', section: 'web' }],
  data: [{ project: 'boot', section: 'data' }],
  security: [{ project: 'security', section: 'servlet' }],
  actuator: [{ project: 'boot', section: 'actuator' }],
  configuration: [
    { project: 'boot', section: 'features' },
    { project: 'boot', section: 'application-properties' },
  ],
};

/** Display titles of every reference the module can emit (keyed "project/section[/subsection]") */
const REFERENCE_TITLES: Record<string, string> = {
  'boot/features': 'Spring Boot: Core Features',
  'boot/using': 'Spring Boot: Using Spring Boot',
  'boot/web': 'Spring Boot: Web',
  'boot/data': 'Spring Boot: Data',
  'boot/actuator': 'Spring Boot: Actuator',
  'boot/application-properties': 'Spring Boot: Application Properties',
  'boot/deployment': 'Spring Boot: Deployment',
  'framework/core/beans': 'Spring Framework: Core — Beans',
  'framework/web': 'Spring Framework: Web',
  'framework/data-access': 'Spring Framework: Data Access',
  'data-jpa/jpa': 'Spring Data JPA: Reference',
  'data-jpa/jpa/transactions': 'Spring Data JPA: Transactionality',
  'security/servlet': 'Spring Security: Servlet Applications',
  'security/authentication': 'Spring Security: Authentication',
  'security/authorization': 'Spring Security: Authorization',
  'security/exploits': 'Spring Security: Protection Against Exploits',
};

/**
 * Returns the rules whose needles appear (lower-cased) in the analyzed text:
 * the error message plus the exception header lines of the trace. Order = table order.
 */
export function matchRules(errorMessage: string, analysis: TraceAnalysis, stackTrace?: string): DiagnosisRule[] {
  const parts: string[] = [(errorMessage ?? '').slice(0, MAX_ERROR_MESSAGE_CHARS)];
  if (stackTrace) {
    // Use the full (capped) header lines so legacy "; nested exception is X" text is searchable
    for (const line of boundedLines(stackTrace)) {
      if (parseHeader(line)) parts.push(line);
    }
  } else {
    for (const link of analysis.chain) parts.push(`${link.type}: ${link.message}`);
  }
  const text = parts.join('\n').toLowerCase();
  const matched = DIAGNOSIS_RULES.filter((rule) => rule.needles.some((n) => text.includes(n)));
  // NoUniqueBeanDefinitionException messages also read "No qualifying bean of type ...":
  // that is not a missing bean.
  if (matched.some((r) => r.id === 'non-unique-bean')) {
    return matched.filter((r) => r.id !== 'missing-bean');
  }
  return matched;
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

const BOOT_DOCS_URL = 'https://docs.spring.io/spring-boot/index.html';

function referenceKey(ref: DiagnosisReference): string {
  return `${ref.project}/${ref.section}${ref.subsection ? `/${ref.subsection}` : ''}`;
}

function renderReferences(refs: DiagnosisReference[], config: SpringProjectsConfig): string[] {
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const ref of refs) {
    if (!config.validateSection(ref.project, ref.section)) continue;
    const url = config.buildReferenceUrl(ref.project, ref.section, ref.subsection);
    if (seen.has(url)) continue;
    seen.add(url);
    const title = REFERENCE_TITLES[referenceKey(ref)] ?? `${ref.project}: ${ref.section}`;
    const sub = ref.subsection ? `, subsection="${ref.subsection}"` : '';
    lines.push(`- ${title} — ${url} (get_spring_reference: project="${ref.project}", section="${ref.section}"${sub})`);
  }
  return lines;
}

function formatLink(link: ExceptionLink): string {
  return link.message ? `${link.type}: ${link.message}` : link.type;
}

export function renderDiagnosis(
  input: { errorMessage: string; component?: string; stackTrace?: string },
  config: SpringProjectsConfig = springProjectsConfig,
): string {
  const errorMessage = (input.errorMessage ?? '').slice(0, MAX_ERROR_MESSAGE_CHARS);
  const analysis = analyzeStackTrace(input.stackTrace);
  const rules = matchRules(errorMessage, analysis, input.stackTrace);

  let component = input.component?.trim() ? input.component.trim().slice(0, 100) : undefined;
  let inferred = false;
  if (!component && analysis.inferredComponent) {
    component = analysis.inferredComponent;
    inferred = true;
  }

  const out: string[] = ['# Spring Boot Issue Diagnosis', '', `**Error:** ${errorMessage}`];
  if (component) {
    out.push(`**Component:** ${component}${inferred ? ' (inferred from the stack trace)' : ''}`);
  }
  out.push('');

  if (analysis.top && analysis.root) {
    out.push('## Exception Summary', '', `**Exception:** ${formatLink(analysis.top)}`);
    if (analysis.chain.length > 1) out.push(`**Root cause:** ${formatLink(analysis.root)}`);
    if (analysis.applicationFrame) out.push(`**Your code:** \`${analysis.applicationFrame}\``);
    out.push('');
  }

  out.push('## Likely Cause', '');
  if (rules.length === 0) {
    out.push(
      'No known pattern matched this error. Read the root cause above (or the error message) and use the references below.',
      '',
    );
  } else {
    for (const rule of rules) {
      out.push(`### ${rule.title}`, '', 'The error text matches a known pattern for this problem.', '', 'What to check:');
      for (const check of rule.checks) out.push(`- ${check}`);
      out.push('');
    }
  }

  const refs: DiagnosisReference[] = rules.flatMap((r) => r.references);
  const componentRefs = component ? COMPONENT_REFERENCES[component.toLowerCase()] : undefined;
  if (componentRefs && Object.prototype.hasOwnProperty.call(COMPONENT_REFERENCES, component!.toLowerCase())) {
    refs.push(...componentRefs);
  }
  const refLines = renderReferences(refs, config);
  out.push('## Reference Documentation', '');
  if (refLines.length > 0) out.push(...refLines);
  else out.push(`- Spring Boot documentation — ${BOOT_DOCS_URL}`);
  out.push('');

  out.push(
    '## General Troubleshooting Steps',
    '',
    `1. Check the Spring Boot documentation: ${BOOT_DOCS_URL}`,
    '2. Search Spring Boot issues: https://github.com/spring-projects/spring-boot/issues',
    '3. Enable debug logging: `logging.level.org.springframework=DEBUG`',
    '4. Check actuator health endpoint: `/actuator/health`',
    '',
  );
  return out.join('\n');
}
