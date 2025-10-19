## ADDED Requirements
### Requirement: Highlighted Assistance Trigger
The canvas MUST let writers send a highlighted lyric fragment directly to the GPT collaborator without manual copy/paste.

#### Scenario: request help for highlight
- **GIVEN** the user highlights text inside the lyric canvas
- **WHEN** they choose the "Ask assistant about selection" action from the toolbar or chat dock
- **THEN** the chat composer is prefilled with a targeted prompt referencing the highlight
- **AND** submitting the message keeps the highlight visible until a reply arrives

### Requirement: Selection-Aware Chat Requests
Chat requests MUST carry the highlighted snippet so the backend prompt can focus on that portion first.

#### Scenario: send targeted payload to backend
- **GIVEN** the user submits a chat request that references a highlighted passage
- **WHEN** the frontend issues the `POST /chat/{document_id}` request
- **THEN** the payload includes the highlighted HTML/text in the `selection` field
- **AND** chat history marks the entry as "selection" to distinguish it from whole-document requests

### Requirement: Selection-Scoped Option Application
Assistant suggestions MUST be applicable to just the highlighted excerpt when one was provided.

#### Scenario: apply option to highlighted section
- **GIVEN** the assistant returns lyric options in response to a targeted request
- **WHEN** the user previews or applies an option
- **THEN** only the highlighted section is replaced by the option’s content while the rest of the document remains unchanged
- **AND** if no highlight exists the system falls back to the current whole-document merge behavior
