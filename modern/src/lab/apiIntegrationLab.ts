import "./apiIntegrationLab.css";
import { registerLabModule } from "./moduleRegistry";

const EXAMPLES: Record<string, { title: string; note: string; code: string }> = {
  libcurl: {
    title: "libcurl",
    note: "Foundational HTTP client library with broad protocol support and explicit control.",
    code: `#include <curl/curl.h>\n\nCURL* curl = curl_easy_init();\nif (!curl) return;\n\ncurl_easy_setopt(curl, CURLOPT_URL, \"https://api.example.com/v1/items\");\ncurl_easy_setopt(curl, CURLOPT_TIMEOUT_MS, 5000L);\n\nstruct curl_slist* headers = nullptr;\nheaders = curl_slist_append(headers, \"Accept: application/json\");\nheaders = curl_slist_append(headers, \"Authorization: Bearer <token-from-secure-source>\");\ncurl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);\n\nCURLcode result = curl_easy_perform(curl);\n\ncurl_slist_free_all(headers);\ncurl_easy_cleanup(curl);`
  },
  cpr: {
    title: "CPR-style wrapper",
    note: "A higher-level C++ wrapper pattern: shorter request code while still thinking in HTTP concepts.",
    code: `auto response = cpr::Get(\n  cpr::Url{\"https://api.example.com/v1/items\"},\n  cpr::Header{{\"Accept\", \"application/json\"},\n              {\"Authorization\", \"Bearer \" + token}},\n  cpr::Timeout{5000}\n);\n\nif (response.status_code == 200) {\n  // Parse response.text as JSON\n} else {\n  // Handle errors intentionally\n}`
  },
  httplib: {
    title: "cpp-httplib-style client",
    note: "A lightweight request/response style useful for learning the mechanics of endpoints, headers, and JSON payloads.",
    code: `httplib::SSLClient client(\"api.example.com\");\nclient.set_connection_timeout(5);\n\nhttplib::Headers headers = {\n  {\"Accept\", \"application/json\"},\n  {\"Authorization\", \"Bearer \" + token}\n};\n\nauto result = client.Get(\"/v1/items\", headers);\nif (result && result->status == 200) {\n  // Parse result->body\n}`
  },
  wrapper: {
    title: "Your own typed wrapper",
    note: "The cleanest application code usually hides HTTP details behind a small domain-specific client class.",
    code: `class WeatherClient {\npublic:\n  explicit WeatherClient(std::string token) : token_(std::move(token)) {}\n\n  Weather getCurrent(std::string_view city) {\n    // Build request\n    // Apply auth + timeout\n    // Send HTTPS request\n    // Parse JSON\n    // Validate required fields\n    // Convert into Weather\n  }\n\nprivate:\n  std::string token_;\n};`
  }
};

function renderApiLab(host: HTMLElement): () => void {
  host.innerHTML = `
    <div class="lab-module api-lab">
      <section class="api-hero lab-panel">
        <div><span class="api-kicker">C++ integration · APIs · SDKs</span><h3>How does C++ use another service?</h3><p class="lab-note">An API wrapper is just a layer that turns your program's function calls into HTTP requests, then converts the response back into useful C++ types.</p></div>
        <div class="api-flow">C++ CALL → WRAPPER → HTTPS → API → JSON → PARSE → C++ OBJECT</div>
      </section>

      <section class="lab-panel"><span class="api-kicker">The request lifecycle</span><div class="api-steps"><div class="api-step"><strong>1 · Endpoint</strong><span>Where?</span></div><div class="api-step"><strong>2 · Method</strong><span>GET / POST</span></div><div class="api-step"><strong>3 · Headers</strong><span>Auth + content type</span></div><div class="api-step"><strong>4 · Body</strong><span>Usually JSON</span></div><div class="api-step"><strong>5 · Response</strong><span>Status + payload</span></div><div class="api-step"><strong>6 · Parse</strong><span>Typed C++ data</span></div></div></section>

      <section class="api-grid">
        <div class="lab-panel"><span class="api-kicker">Choose an approach</span><div class="api-stack" data-api-options></div></div>
        <div class="lab-panel"><span class="api-kicker">Example C++</span><h4 data-api-title></h4><p class="lab-note" data-api-note></p><code class="api-code" data-api-code></code></div>
      </section>

      <section class="api-grid">
        <div class="lab-panel"><span class="api-kicker">Anatomy of a REST call</span><div class="api-request"><div class="api-request-row"><strong>Method</strong><code>GET</code></div><div class="api-request-row"><strong>URL</strong><code>https://api.example.com/v1/items</code></div><div class="api-request-row"><strong>Header</strong><code>Authorization: Bearer …</code></div><div class="api-request-row"><strong>Header</strong><code>Accept: application/json</code></div><div class="api-request-row"><strong>Response</strong><code>{ "items": [ ... ] }</code></div></div></div>
        <div class="lab-panel"><span class="api-kicker">Failures are normal</span><div class="api-stack"><div class="api-option"><strong>Timeout</strong><span>Never wait forever.</span></div><div class="api-option"><strong>HTTP 429</strong><span>Respect rate limits and retry with backoff.</span></div><div class="api-option"><strong>HTTP 401 / 403</strong><span>Auth or permission problem.</span></div><div class="api-option"><strong>HTTP 5xx</strong><span>Server-side failure; retry only when appropriate.</span></div><div class="api-option"><strong>Bad JSON / schema change</strong><span>Validate before trusting fields.</span></div></div></div>
      </section>

      <section class="lab-panel api-security"><span class="api-kicker">Security exercise</span><strong>Where should the API key live?</strong><div class="api-quiz"><button type="button" data-api-answer="source">Hard-coded in source</button><button type="button" data-api-answer="repo">Committed config file</button><button type="button" data-api-answer="env">Environment / secret store</button><button type="button" data-api-answer="frontend">Public browser bundle</button></div><p class="lab-note api-feedback" data-api-feedback>Choose the safest answer.</p></section>

      <section class="lab-panel"><span class="api-kicker">Practical architecture</span><p class="lab-note">For a desktop C++ app, credentials can come from an OS credential store, environment configuration, or a protected local service. For a public web app, secrets must stay on a backend you control—the browser bundle is visible to users. A wrapper class should expose functions like <code>getWeather()</code> or <code>createTicket()</code>, not spread raw HTTP details throughout your application.</p></section>
    </div>`;

  const optionsHost = host.querySelector<HTMLElement>("[data-api-options]")!;
  const title = host.querySelector<HTMLElement>("[data-api-title]")!;
  const note = host.querySelector<HTMLElement>("[data-api-note]")!;
  const code = host.querySelector<HTMLElement>("[data-api-code]")!;
  const feedback = host.querySelector<HTMLElement>("[data-api-feedback]")!;
  let selected = "libcurl";

  const draw = () => {
    optionsHost.replaceChildren();
    Object.entries(EXAMPLES).forEach(([id, example]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "api-option";
      button.setAttribute("aria-pressed", String(id === selected));
      const strong = document.createElement("strong"); strong.textContent = example.title;
      const span = document.createElement("span"); span.textContent = example.note;
      button.append(strong, span);
      button.addEventListener("click", () => { selected = id; draw(); });
      optionsHost.append(button);
    });
    const example = EXAMPLES[selected];
    title.textContent = example.title;
    note.textContent = example.note;
    code.textContent = example.code;
  };

  host.querySelectorAll<HTMLButtonElement>("[data-api-answer]").forEach(button => button.addEventListener("click", () => {
    const answer = button.dataset.apiAnswer;
    feedback.textContent = answer === "env"
      ? "Best of these choices. Use an environment/secret store or OS credential mechanism, and avoid logging the secret."
      : answer === "frontend"
        ? "Not safe for a secret. Anything shipped to a browser should be treated as public."
        : "Avoid this. Source repositories and committed config files are common ways secrets leak.";
  }));

  draw();
  return () => {};
}

registerLabModule({ id: "cpp-api-integration", icon: "🔌", title: "C++ API Integration", description: "Learn REST calls, JSON, libcurl-style clients, wrappers, retries, timeouts, authentication, and safe secret handling in C++.", featured: true, render: renderApiLab });
