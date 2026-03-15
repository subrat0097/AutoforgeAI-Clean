# AutoForgeAI

AutoForgeAI is an AI-powered developer tool that generates complete production-ready applications from a single prompt using **AWS Amazon Nova**.

## Features

* Generate full-stack apps from text prompts
* Automatic architecture diagrams (Mermaid)
* Security & threat modeling report
* Deployment guide generation
* Download complete project as ZIP
* Live preview of generated apps

## Tech Stack

* Next.js 14
* TypeScript
* Tailwind CSS
* AWS Bedrock
* Amazon Nova Pro
* Amazon Nova Lite

## Run Locally

```bash
npm install
npm run dev
```

Then open:

```
http://localhost:3000
```

## Environment Variables

Create `.env.local`

```
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
AWS_REGION=us-east-1
```

## License

MIT
