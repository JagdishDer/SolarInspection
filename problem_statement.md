# Take Home

## Overview

Build a high-performance offline-first field inspection screen for a renewable energy solar farm management mobile application using React Native, TypeScript, and Expo.

## Background

Field technicians frequently conduct inspections at remote solar farm installations where cellular connectivity is intermittent or entirely unavailable. They need a robust mobile interface that allows them to record component anomalies, capture structured metrics, and queue submissions locally until a stable connection is re-established.

You are tasked with building the core inspection logging module for this application using React Native, Expo, and TypeScript. The module must gracefully handle local state persistence, complex form validation, and simulated API synchronization.

## Requirements

This assignment requires React Native, Expo, and TypeScript. Build a self-contained feature module meeting the specifications below.

### Core Component & UI Architecture
* **Inspection Form**: Implement a multi-section form capturing `AssetID` (string), `Severity` (enum: low, medium, critical), `ThermalReading` (number), `Notes` (string), and optional photo attachment placeholders.
* **Responsive Layout**: Ensure smooth UI rendering and adaptive layout across both iOS and Android platforms without layout shifts during keyboard interactions.
* **Virtualized Lists**: Display a searchable, filterable history list of recent local inspection logs using optimized React Native list components.

### State Management & Offline Persistence
* **Local Storage**: Use a robust local persistence layer (such as AsyncStorage or Expo SQLite) to save inspection drafts and queued submissions automatically.
* **Sync Queue Manager**: Implement a synchronization status manager that tracks pending vs. successfully synced records when network connectivity toggles.

### API Integration & Mock Service
* **REST Endpoint Simulation**: Create a robust API client wrapper that posts inspection payloads to a mocked endpoint with simulated network latency and intermittent failure rates (e.g., 20% random error rate).
* **Error Handling & Retries**: Implement exponential backoff retry logic and clear user-facing error states for failed submissions without losing local draft data.

## How We'll Evaluate

Here is how your submission will be evaluated:

| What We'll Evaluate | Weight | What We Look For |
|---|---|---|
| Working with AI | 30% | Clear demonstration of prompting strategy, verification of generated code, and effective direction of the AI assistant. |
| Code Quality & Architecture | 30% | Clean, modular code structure utilizing TypeScript effectively and maintaining clear separation of concerns. |
| Performance & Mobile Craft | 25% | Smooth mobile experiences, efficient list rendering, and reliable integration with external data sources. |
| Reasoning & Approach | 15% | Documented trade-offs and the strategic rationale behind your key architectural and design choices. |

## Deliverables

Submit the following:

- **Working code** — A complete, runnable React Native and Expo project implementing the assigned mobile feature.
- **README** — Comprehensive documentation covering project setup, architectural decisions, trade-offs, and future improvements.
  Required sections: Setup & Run, Decisions & Trade-offs, What I Skipped, What I'd Do Next

## Submission Instructions

Package all project files, including source code, configuration files, and the README, into a single ZIP file. Do not include external links, hosted demos, or repository links. Submit the ZIP file directly through the portal in its native format.

## Additional Notes

An AI coding assistant is provided for this assignment. Focus on precise component architecture, robust TypeScript typing, and clean state management patterns while leveraging your AI assistant for boilerplate generation.

## Working with the AI assistant

This assignment gives you an AI assistant, and how you work with it is part of what we look at - so use it the way you naturally would on the job.

If your assignment has an AI budget and you reach it, the assistant stops - but you can keep working and submit as usual.

## Submitting your work

When you're done, submit from VS Code: open the Command Palette (Ctrl/Cmd+Shift+P) → "Tasks: Run Task" → "Submit assessment" (or use Terminal → Run Task). It packages your workspace, uploads it, and opens a confirmation page in your browser.

Not using VS Code? Run `./submit.sh` (macOS/Linux) or `.\submit.ps1` (Windows) from the workspace folder.
