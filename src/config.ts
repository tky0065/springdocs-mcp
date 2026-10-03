export type TransportMode = "stdio" | "http";

export interface ServerConfig {
  transport: TransportMode;
  host: string;
  port: number;
  allowedHosts: string[];
}

const TRANSPORTS: TransportMode[] = ["stdio", "http"];

/** Value of `--name value` or `--name=value`; undefined when the option is absent. */
function readOption(argv: string[], name: string): string | undefined {
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === name) {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith("--")) {
        throw new Error(`${name} requires a value`);
      }
      return value;
    }
    if (arg.startsWith(`${name}=`)) return arg.slice(name.length + 1);
  }
  return undefined;
}

export function parseConfig(argv: string[], env: NodeJS.ProcessEnv): ServerConfig {
  const transport = readOption(argv, "--transport") ?? env.MCP_TRANSPORT ?? "stdio";
  if (!TRANSPORTS.includes(transport as TransportMode)) {
    throw new Error(`Invalid transport "${transport}". Allowed: ${TRANSPORTS.join(", ")}`);
  }

  const rawPort = readOption(argv, "--port") ?? env.MCP_PORT ?? "3000";
  const port = Number(rawPort);
  if (rawPort.trim() === "" || !Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error(`Invalid port "${rawPort}": expected an integer between 0 and 65535`);
  }

  const host = readOption(argv, "--host") ?? env.MCP_HOST ?? "127.0.0.1";
  const allowedHosts = (env.MCP_ALLOWED_HOSTS ?? "").split(",").map(value => value.trim()).filter(Boolean);

  return { transport: transport as TransportMode, host, port, allowedHosts };
}
