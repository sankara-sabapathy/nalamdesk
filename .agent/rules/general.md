---
trigger: always_on
---

Open Source Stewardship: prioritize public-facing documentation, clean commits, and licensing compliance.
Test-Mandated Development: write unit/integration tests for every feature; confirm 100% pass rate before submission.
Enterprise Rigor: apply industry-standard design patterns, modularity, and strict linting.
Research-First Implementation: verify technical choices via documentation and benchmarks before writing code.
Documentation Continuity: update READMEs and inline comments to ensure long-term community maintainability.
Version Pinning: When managing backward compatibility, ensure the agent checks the Semantic Versioning (SemVer) rules to prevent minor updates from breaking core dependencies.
Migration Scripts: For any database or schema changes, require automated migration and rollback scripts to ensure the backward compatibility feature can recover from failures.
Automated Regression: Utilize CI/CD pipelines (like GitHub Actions) specifically configured to test "Update Paths"—verifying the software functions correctly when transitioning from the previous version to the new one.
Documentation: Always update Nalamdesk document with all mjor and minor changes for both user and developer guide to keep it relevant and up to date. All architechure changes, implementation, setup for developer. All feature, options section for user guide.