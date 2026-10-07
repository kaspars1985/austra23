# AGENTS.md - Austra Extension Development Guidelines

## Autonomous Execution & Planning Workflow

### 1. Mandatory Planning Step
- For any new feature, bug fix, or refactoring task, the agent **MUST ALWAYS** start by creating an **Implementation Plan artifact** (`RequestFeedback: true`).
- The plan must outline:
  - Problem analysis and root cause.
  - Planned file modifications and logic changes.
  - Verification & testing plan (e.g. running `node test/test_extension.js`).
- The agent **MUST NOT** edit files or execute destructive actions before the user has approved the plan (via the "Proceed" button or explicit message).

### 2. Autonomous Execution
- Once the plan is confirmed/approved by the user:
  - Execute all code edits and file modifications autonomously.
  - Run tests and verifications automatically.
  - Do not ask for permissions or intermediate confirmations unless a critical ambiguity or blocker arises.

### 3. Verification & Quality
- Always run the test suite (`node test/test_extension.js`) before marking any task as complete.
- Ensure version numbers remain synchronized across `manifest.json`, `content.js`, `popup.html`, `test/test_extension.js`, and `README.md`.
