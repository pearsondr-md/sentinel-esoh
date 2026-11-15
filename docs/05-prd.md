# Product requirements

SENTINEL is a working Army ESOH system. These requirements describe the product an Army customer should be able to recognize as their own work. They do not authorize a real installation to use it for official records.

The fictional setting is **Camp Sentinel**, a made-up garrison with a garrison staff and two tenant units. Every person, shop, container, and event is synthetic.

## Problem

Safety and environmental work fails when each program keeps a separate list. An inspection finding, a hazard, a risk decision, and a corrective action need to stay connected, and the original finding needs to stay readable after the action is closed.

Army policy already describes that kind of system. ASOHMS is the management framework. ATP 5-19 is the risk method. The product follows those sources. It does not invent a parallel scoring system and rename it.

## Users in the first milestone

Roles are job names a learner can recognize. They are scoped to an organization. A person in one tenant unit does not see another unit’s draft records.

- **Employee or Soldier.** Files a written hazard report and sees the status of that report. The report can omit the reporter’s name on the shared log. DA Pam 385-10 treats written employee reports, and DA Form 4755, as part of inspections and assessments. AR 385-10 paragraph 1-10 says people must be able to report unsafe conditions without reprisal.
- **Supervisor.** Confirms a report in their shop and carries out an assigned control. The seed data does not give this role authority to accept high or extremely high residual risk. Medium and low authority are not configured until Table 4-1 is verified, so this role also cannot accept those levels in the first build.
- **Safety officer.** Creates inspections, findings, and hazards; enters probability and severity; writes controls and corrective actions. Entering an estimate is not the same act as accepting the risk.
- **Commander.** Records the human decision to accept or not accept residual risk, and only when a verified authority row says that grade may do so for that level and duration. If the row is unverified, the product stores the attempt as blocked and explains why.
- **Administrator.** Creates synthetic users and organizations. Cannot erase history.

Environmental officer, occupational health program manager, and assessor are real roles for later capabilities. They are not required to finish the first milestone. Adding them early would widen the product before the core path is understood.

## First milestone

One working path:

1. Create an inspection.
2. Record an observation and a finding. The finding text is kept as first written.
3. Link or create a hazard from the finding.
4. Record probability and severity. The server returns the doctrinal matrix result. A person does not type a different level.
5. Record controls and a revised probability and severity. The server returns the residual matrix result.
6. Record a separate human decision to accept or not accept that residual risk, checked against risk-acceptance authority.
7. Assign a corrective action, attach evidence, and verify it. The verifier is a different user from the person who completed the action.
8. Close the action. The finding, the earlier matrix results, and the decision remain readable.

The acceptance story for this milestone is the unlabeled-container inspection described in the [workflow note](08-workflow.md).

A minimal screen is part of the milestone only after the server rules are clear enough to explain. If a one-hour day is spent understanding a rule, that day is successful even if no new screen appears.

## Later capabilities

These are required for the full learning product. They are built after the first milestone, not inside the 42-day plan except as reading.

- **Environmental compliance.** Obligations, waste, materials, and spills that create findings and actions in the same workflow. Applicability differs by place. The product tracks obligations. It does not issue a compliance determination.
- **Occupational health.** Synthetic exposure-group counts and program status. No individual health information.
- **Executive view.** Counts a council would ask about, drawn from records already in the system. AR 385-10 paragraph 1-17 is the menu of questions. The view is not a doctrinal readiness score.
- **ASOHMS practice records.** Six objectives and placeholder criteria. Practice statuses are local notes. The product will say on the screen that it does not produce an official Army assessment.
- **AI assistance.** Explanations and questions with record citations and source-register citations. No authority to change a record. Details are in the [security note](09-security-ai-governance.md).

## Cross-cutting rules

- History is append-only. Closing is a new event, not a deletion.
- Risk is three records: matrix result, human decision, and authority check. No override of the matrix and no exception path until a publication paragraph for that exception has been verified and written down.
- Synthetic data only.
- The interface uses Army terms where the publication uses them (mishap, hazard, control, residual risk) and explains them in plain language the first time a person meets them.
- The visual design uses black and gold and SENTINEL’s own logo. Official Army marks are not reproduced. Fields are labeled, and the page can be operated from the keyboard.
- Another organization could reuse the workflow by configuring organization names and roles. The risk matrix and the authority rules stay sourced. They are not silently replaced with a generic score.

## Outside this product

CAC login, a connection to Army systems of record, classified information, individual medical records, acquisition safety, range deviations, ammunition and explosives deviations, and any claim of an Authority to Operate or an official assessment.
