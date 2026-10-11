# Architecture decisions

- **Go modular monolith:** keep the first release simple to build and deploy.
- **React Native:** share the majority of the mobile UI and product logic.
- **Native bridges are expected:** screen capture/overlays on Android and share extensions on iOS require platform-specific implementation and policy review.
- **Neon PostgreSQL:** source of truth for durable data.
- **Redis:** cache and rate limiting; never the source of truth for subscriptions or user records.
- **Provider interfaces:** OCR and translation providers can be changed without rewriting business logic.
- **Privacy:** do not persist screenshots or full screen text by default; redact logs and use explicit consent.
