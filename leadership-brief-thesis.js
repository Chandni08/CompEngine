(function registerLeadershipBriefThesis(root) {
  function leadershipBriefThesis() {
    return "Leadership Brief";
  }

  const api = { leadershipBriefThesis };
  root.CompetitionEngineLeadership = api;

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis === "object" ? globalThis : this);
