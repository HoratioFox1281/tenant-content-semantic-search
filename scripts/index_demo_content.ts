import type { ContentArea } from "../src/infrai_search.js";

type DemoContent = {
  id: string;
  area: ContentArea;
  title: string;
  body: string;
  lifecycle: "active";
};

const documents = [
  { id: "acme-welcome", area: "onboarding", title: "Publish the first workspace", body: "Invite an editor, choose a channel, and publish the welcome story.", lifecycle: "active" },
  { id: "acme-owner", area: "account_lifecycle", title: "Transfer workspace ownership", body: "An existing owner can nominate and confirm a replacement owner.", lifecycle: "active" },
  { id: "acme-roles", area: "admin_operations", title: "Review creator roles", body: "Workspace admins review editor and producer access from the members screen.", lifecycle: "active" },
] as const satisfies readonly DemoContent[];

console.log(JSON.stringify(documents, null, 2));
