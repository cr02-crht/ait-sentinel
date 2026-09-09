export type WatchedScenario = {
  id: number;
  name: string;
};

// Stand-in for the Automation Catalog until that's backed by a real database.
// Add the Make.com scenario ID (the number in the scenario's URL) for anything you want monitored.
export const watchedScenarios: WatchedScenario[] = [
  // { id: 123456, name: "Slack Lead Alerts" },
];
