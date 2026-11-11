# Security and AI governance

SENTINEL is a synthetic classroom system. This note states the controls for the learning build and the boundary around a later Grok integration. It also states what a real Army deployment would still have to do. Those later steps are not claimed as done.

## What this demonstration is

- Data is invented. Camp Sentinel is not a real garrison. Names, injuries, permits, and wastes are synthetic.
- The system has no Authority to Operate, no FedRAMP authorization, and no operational, safety, or environmental certification.
- A score, a placeholder ASOHMS status, or an AI paragraph is not an official Army assessment and not a compliance determination.

## Controls for the learning build

- **Identity.** Server-side sessions. Passwords stored as hashes. The session cookie is not a place to put roles that the server fails to check again.
- **Authorization.** Every route checks the user’s role and organization. A tenant unit token does not read another unit’s drafts. Administrator rights do not include deleting history.
- **Secrets.** The database file and, later, the xAI key live on the server. The key is an environment variable. It is not written into the client bundle, a screenshot, or a document in this repository.
- **Input checks.** The server checks types, required fields, and allowed status moves. The matrix level is computed, not accepted from the browser as an authority.
- **Human approval.** Residual-risk acceptance is a `risk_decision` by a user, plus an `authority_check`. The check fails closed when the doctrinal cell is unverified. There is no override flag.
- **Audit.** `record_event` is insert-only. Finding text is insert-once.
- **Files.** Evidence download checks organization and role. The path is stored. The client does not choose a raw filesystem path.
- **Health data.** The first milestone has no health tables. The reserved `exposure_group` shape has counts only. A later test should attempt to submit a diagnosis field and should fail because the field does not exist and the route rejects unknown health fields.
- **Segregation.** Organizational scope is the segregation model in this build. It is not a classified-network design.

## AI, when that capability is built

Grok is reached through the xAI API from the Express server. The model does not receive database credentials, a connection string, or permission to run SQL. The server loads the records the user’s role may see, builds a prompt from those records and from source-register cards, and sends that text.

The interface keeps two citation labels:

- **From Camp Sentinel records,** with record ids that were in the prompt.
- **From the source register,** with the publication, paragraph or table, and the review status (verified on a date, or still unresolved).

The prompt instructions, enforced again by a server check on the way out, are:

- Separate facts, observations, assumptions, and recommendations.
- Say when the records are too few to support a conclusion.
- Cite a record id only if it was supplied.
- Cite a publication only if its card was supplied.
- If the reply names a publication that was not supplied, store and show that citation as unverified. Do not upgrade it to a source.
- State conflicts and uncertainty, including the known label differences among ASOHMS sources and any unresolved validation item that the question touches.
- Decline to set a risk level, accept risk, assign an action, or close a record. The server does not expose those functions to the model. The reply is stored as text. It is not applied to a row.

Individual health information is not placed in a prompt. The aggregate exposure-group view, if it exists by then, is the most the model may see, and only when the user’s role may see it.

The AI panel does not contain the buttons that change workflow state.

## What a real Army deployment would still require

This list is a gate, not a design for this repository.

- A privacy and records review, including a system-of-records decision if any real personnel data were ever in scope. This demo never crosses that line.
- The Risk Management Framework: categorize the system, select and assess controls, have an authorizing official accept the risk of operating the system, and monitor it. That is a different “risk acceptance” from a commander accepting a shop hazard. The two must not be mixed in the interface.
- Identity that meets Army requirements, typically CAC or an approved equivalent, and role management tied to real units.
- An approved hosting environment and a connection decision for any live system such as the Army Safety Management Information System, DOEHRS, or the ASOHMS portal. This project plans no such connection.
- A legal review before environmental obligations or mishap records are used for any real reporting.
- A configuration-management process so doctrine tables (the matrix and Table 4-1) change only when a publication change is verified.
- Logging, backup, and incident response appropriate to the real data. Synthetic classroom data does not satisfy that requirement by analogy.

Until those gates are actually passed by the government organizations that own them, SENTINEL remains a training application.
