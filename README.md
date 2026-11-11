# SENTINEL

SENTINEL is a learning project: an Army-oriented environment, safety, and occupational health (ESOH) demonstration, built slowly enough that the doctrine and the code can both be understood.

This repository currently holds research and design notes only. There is no application code and no installed packages.

Nothing in these notes is an official Army assessment, an Authority to Operate, or a certification. Camp Sentinel, the fictional garrison used in examples, is not a real installation.

## Read these in order

1. [Doctrine and regulatory baseline](docs/01-doctrine-baseline.md) — what kind of document each Army source is, and what SENTINEL is built around.
2. [Source register](docs/02-source-register.md) — publication facts checked on 10 November 2026, kept separate from items that are still unresolved.
3. [ASOHMS mapping](docs/03-asohms-mapping.md) — the six capability objectives and the three maturity stages. Official criteria text is still a placeholder.
4. [Traceability matrix](docs/04-traceability-matrix.md) — which capability follows which authority, and what this demo will not decide.
5. [Product requirements](docs/05-prd.md) — who uses the first milestone, and which capabilities wait.
6. [Architecture](docs/06-architecture.md) — React, TypeScript, Tailwind, Node, Express, and SQLite. No extra infrastructure.
7. [Data model](docs/07-data-model.md) — the records and how history is kept.
8. [First workflow](docs/08-workflow.md) — inspection, finding, hazard, risk assessment, corrective action, and verification. This is the first working milestone.
9. [Security and AI governance](docs/09-security-ai-governance.md) — human decisions, synthetic data, and how Grok will be used later.
10. [42-day roadmap](docs/10-roadmap.md) — about one hour a day. Understanding comes before feature count.

## First milestone

The first working application is one path:

**Inspection → finding → hazard → risk assessment → corrective action → verification.**

Environmental compliance, occupational health, executive analytics, and AI are later capabilities. They sit on this path. They are not part of the first build.

## How risk is recorded

Three different facts stay in three different places:

- The **doctrinal matrix result** comes from probability and severity, using ATP 5-19.
- The **human risk decision** is a person accepting or not accepting that residual risk.
- The **risk-acceptance authority** is whether that person’s position is allowed to make the decision.

No exception or override will be built until the doctrinal basis for that exception has been verified. See [the workflow note](docs/08-workflow.md).

## Validation still open

The source register lists these in full. The items that block official content are:

- The 48 ASOHMS criteria. They were not in the open publications reviewed here. SENTINEL will not invent them and will not present a score as an official Army assessment.
- Whether Army Directive 2024-09’s required implementing guidance was published, and whether AR 385-10 has been revised since the 24 July 2023 edition.
- The medium and low rows of DA Pam 385-30 Table 4-1, plus delegation. The public text extract was not reliable enough to encode.
- Mishap class thresholds in DA Pam 385-40. They were not transcribed, so they will not be guessed.
- Latest-change confirmation on esd.whs.mil for several DoD instructions whose change numbers were taken from a directive citation or a secondary copy.
- AR 11-35. It appeared on an Army Publishing Directorate list. The PDF was not opened.

Re-check the Army Publishing Directorate and the DoD issuances site before treating any of this as still current. A catalog status of “active,” especially from an older index, is not by itself proof that the publication is the latest.
