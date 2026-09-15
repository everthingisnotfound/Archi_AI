# Active Assessment API

`POST /internal/assessment/active` runs bounded, authenticated validation against
an explicitly scoped set of public endpoints. It is an internal worker-to-AI
service endpoint and requires the same signed bearer token as the other
internal analysis routes.

The request contains canonical endpoint records and an explicit `allowed_hosts`
set. The service only permits `GET` and `HEAD`, refuses out-of-scope hosts,
does not follow redirects, and applies request, concurrency, delay, timeout,
response-size, and total-duration budgets. Probe mutations are limited to
harmless query-string markers and diagnostic values; the service does not
submit forms, brute-force credentials, probe private networks, or perform
destructive operations.

Results are deterministic evidence records with a finding lifecycle
(`candidate`, `validating`, `supported`, `confirmed`, `inconclusive`, or
`rejected`), confidence, limitations, and response-differential evidence.
Rate-limit responses are recorded as informational observations and are not
presented as proof of a rate-limiting vulnerability.
