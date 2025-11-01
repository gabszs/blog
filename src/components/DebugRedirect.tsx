import { useEffect, useState } from "react";

interface TracePayload {
  id: string;
  created_at: string;
  campaign_id: string;
  api_key_id: string;
  redirect_url: string;
  final_url: string;
  [key: string]: string | number | boolean | null;
}

interface DebugInfo {
  trace_payload: TracePayload;
  final_url: string;
  timestamp: string;
  error?: string;
  api_key_valid?: boolean;
  api_key_info?: {
    id: string;
    isActive: boolean;
    token: string;
  };
}

export default function DebugRedirect() {
  const [searchParams, setSearchParams] = useState<Record<string, string>>({});
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Read URL params manually to preserve precision
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paramsObj: Record<string, string> = {};
    for (const [key, value] of params.entries()) {
      paramsObj[key] = value;
    }
    setSearchParams(paramsObj);
  }, []);

  // Process debug info
  useEffect(() => {
    const processDebugInfo = async () => {
      const { campaign_id, redirect_url, api_key, ...extraParams } =
        searchParams;

      if (!campaign_id && !redirect_url && !api_key) {
        return;
      }

      setIsLoading(true);

      try {
        let apiKeyInfo = null;
        let apiKeyValid = false;

        if (api_key) {
          try {
            const serverUrl =
              import.meta.env.PUBLIC_SERVER_URL || "http://localhost:8787";
            const response = await fetch(`${serverUrl}/v1/auth/api-key`, {
              headers: {
                "x-api-key": api_key,
              },
            });

            if (response.ok) {
              const data = await response.json();
              apiKeyInfo = data;
              apiKeyValid = data.isActive;
            }
          } catch (_error) {
            apiKeyValid = false;
          }
        }

        const trace_id = crypto.randomUUID();
        const created_at = new Date().toISOString();

        let final_url = redirect_url || "";
        if (final_url) {
          const url = new URL(final_url);
          for (const [key, value] of Object.entries(extraParams)) {
            if (value) {
              url.searchParams.set(key, value);
            }
          }
          url.searchParams.set("trace_id", trace_id);
          if (api_key) {
            url.searchParams.set("api_key", api_key);
          }
          final_url = url.toString();
        }

        const trace_payload: TracePayload = {
          id: trace_id,
          created_at,
          campaign_id: campaign_id || "missing",
          api_key_id: apiKeyInfo?.id || "unknown",
          redirect_url: redirect_url || "missing",
          final_url,
          ...extraParams,
          country: "BR",
          city: "São Paulo",
          colo: "GRU",
          timezone: "America/Sao_Paulo",
          asn: "1234",
          "user-agent": navigator.userAgent,
          "accept-language": navigator.language,
        };

        const info: DebugInfo = {
          trace_payload,
          final_url,
          timestamp: new Date().toISOString(),
          api_key_valid: apiKeyValid,
          api_key_info: apiKeyInfo,
        };

        if (!redirect_url) {
          info.error = "Missing required parameter: redirect_url";
        } else if (!api_key) {
          info.error = "Missing required parameter: api_key";
        } else if (!campaign_id) {
          info.error = "Missing required parameter: campaign_id";
        } else if (!apiKeyValid) {
          info.error = "API key is invalid or inactive";
        }

        setDebugInfo(info);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        setDebugInfo({
          trace_payload: {
            id: "",
            created_at: "",
            campaign_id: "",
            api_key_id: "",
            redirect_url: "",
            final_url: "",
          },
          final_url: "",
          timestamp: new Date().toISOString(),
          error: errorMessage,
        });
      } finally {
        setIsLoading(false);
      }
    };

    processDebugInfo();
  }, [searchParams]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const hasParams =
    searchParams.campaign_id ||
    searchParams.redirect_url ||
    searchParams.api_key;

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6">
      {/* Header */}
      <div className="border-b pb-4 flex items-center gap-3">
        <svg
          className="h-8 w-8 text-skin-accent"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-label="Debug icon"
        >
          <title>Debug Icon</title>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        <div>
          <h1 className="font-bold text-3xl">Debug Redirect</h1>
          <p className="opacity-70 text-sm">
            Visual debugger for the redirect endpoint
          </p>
        </div>
      </div>

      {/* Instructions */}
      {!hasParams && (
        <div className="rounded-lg border bg-skin-card p-6">
          <h2 className="mb-4 text-xl font-semibold">How to use</h2>
          <p className="mb-4 opacity-80">
            Add query parameters to this page URL to simulate the redirect
            endpoint
          </p>

          <div className="space-y-4">
            <div>
              <h3 className="mb-2 text-sm font-medium">Example URL:</h3>
              <code className="block rounded bg-skin-accent/10 p-3 text-xs">
                /debug?campaign_id=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx&redirect_url=https://example.com&api_key=your-api-key&utm_source=test
              </code>
            </div>

            <div>
              <h3 className="mb-2 text-sm font-medium">Required Parameters:</h3>
              <ul className="ml-4 list-disc space-y-1 text-sm opacity-80">
                <li>
                  <code>campaign_id</code>: UUID of the campaign
                </li>
                <li>
                  <code>redirect_url</code>: Target URL to redirect to
                </li>
                <li>
                  <code>api_key</code>: Your API key
                </li>
              </ul>
            </div>

            <div>
              <h3 className="mb-2 text-sm font-medium">Optional Parameters:</h3>
              <p className="text-sm opacity-80">
                Any additional query parameters (utm_source, utm_medium, etc.)
                will be included in the trace and final URL
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center rounded-lg border bg-skin-card p-12">
          <div className="text-center">
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-skin-accent border-t-transparent"></div>
            <p className="text-sm opacity-70">Processing debug info...</p>
          </div>
        </div>
      )}

      {/* Debug Info */}
      {!isLoading && debugInfo && hasParams && (
        <>
          {/* Status */}
          <div className="rounded-lg border bg-skin-card p-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">Status</h2>
                <p className="text-sm opacity-70">
                  Timestamp: {debugInfo.timestamp}
                </p>
              </div>
              <div>
                {debugInfo.error ? (
                  <span className="inline-flex items-center rounded bg-red-500/20 px-3 py-1 text-sm font-medium text-red-500">
                    Error
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded bg-green-500/20 px-3 py-1 text-sm font-medium text-green-500">
                    Valid
                  </span>
                )}
              </div>
            </div>

            {debugInfo.error && (
              <div className="rounded bg-red-500/10 p-4">
                <p className="text-sm font-medium text-red-500">
                  {debugInfo.error}
                </p>
              </div>
            )}

            {debugInfo.api_key_valid !== undefined && (
              <div className="mt-4 flex items-center gap-2">
                <span className="text-sm">API Key Status:</span>
                {debugInfo.api_key_valid ? (
                  <span className="rounded bg-green-500/20 px-2 py-1 text-xs font-medium text-green-500">
                    Valid & Active
                  </span>
                ) : (
                  <span className="rounded bg-red-500/20 px-2 py-1 text-xs font-medium text-red-500">
                    Invalid or Inactive
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Query Parameters */}
          <div className="rounded-lg border bg-skin-card p-6">
            <h2 className="mb-4 text-xl font-semibold">Query Parameters</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="pb-2 pr-4 font-medium">Parameter</th>
                    <th className="pb-2 font-medium">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(searchParams).length > 0 ? (
                    Object.entries(searchParams).map(([key, value]) => (
                      <tr key={key} className="border-b last:border-0">
                        <td className="py-2 pr-4 font-mono text-xs">{key}</td>
                        <td className="py-2 font-mono text-xs">
                          {value || (
                            <span className="italic opacity-50">empty</span>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={2} className="py-4 text-center opacity-50">
                        No query parameters
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Final URL */}
          {debugInfo.final_url && (
            <div className="rounded-lg border bg-skin-card p-6">
              <h2 className="mb-4 text-xl font-semibold">Final Redirect URL</h2>
              <p className="mb-4 text-sm opacity-70">
                This is where the user would be redirected
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={debugInfo.final_url}
                  readOnly
                  className="flex-1 rounded border bg-skin-fill px-3 py-2 font-mono text-sm"
                />
                <button
                  onClick={() => copyToClipboard(debugInfo.final_url)}
                  className="rounded border px-4 py-2 hover:bg-skin-accent/10"
                >
                  {copied ? "✓" : "Copy"}
                </button>
                <button
                  onClick={() => window.open(debugInfo.final_url, "_blank")}
                  className="rounded border px-4 py-2 hover:bg-skin-accent/10"
                >
                  Open
                </button>
              </div>
            </div>
          )}

          {/* Trace Payload */}
          <div className="rounded-lg border bg-skin-card p-6">
            <h2 className="mb-4 text-xl font-semibold">Trace Payload</h2>
            <p className="mb-4 text-sm opacity-70">
              Data that would be sent to the queue
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="pb-2 pr-4 font-medium">Key</th>
                    <th className="pb-2 font-medium">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(debugInfo.trace_payload).map(
                    ([key, value]) => (
                      <tr key={key} className="border-b last:border-0">
                        <td className="py-2 pr-4 font-mono text-xs">{key}</td>
                        <td className="py-2 font-mono text-xs">
                          {value === null
                            ? "null"
                            : typeof value === "object"
                              ? JSON.stringify(value)
                              : String(value)}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* API Key Info */}
          {debugInfo.api_key_info && (
            <div className="rounded-lg border bg-skin-card p-6">
              <h2 className="mb-4 text-xl font-semibold">
                API Key Information
              </h2>
              <table className="w-full text-left text-sm">
                <tbody>
                  <tr className="border-b">
                    <td className="py-2 pr-4 font-medium">ID</td>
                    <td className="py-2 font-mono text-xs">
                      {debugInfo.api_key_info.id}
                    </td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 pr-4 font-medium">Status</td>
                    <td className="py-2">
                      {debugInfo.api_key_info.isActive ? (
                        <span className="rounded bg-green-500/20 px-2 py-1 text-xs font-medium text-green-500">
                          Active
                        </span>
                      ) : (
                        <span className="rounded bg-red-500/20 px-2 py-1 text-xs font-medium text-red-500">
                          Inactive
                        </span>
                      )}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 font-medium">Token</td>
                    <td className="py-2 font-mono text-xs">
                      {debugInfo.api_key_info.token.substring(0, 20)}...
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* Raw JSON */}
          <div className="rounded-lg border bg-skin-card p-6">
            <h2 className="mb-4 text-xl font-semibold">Raw JSON</h2>
            <div className="rounded bg-skin-accent/10 p-4">
              <pre className="overflow-x-auto font-mono text-xs">
                {JSON.stringify(debugInfo, null, 2)}
              </pre>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
