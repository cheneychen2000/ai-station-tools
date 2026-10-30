/* 自动生成：src/lib/i18n.mjs QUIZ_EN 序列化，构建期写入，禁止手改 */
window.QUIZ_EN_CFG = {"dims":[{"key":"concept","label":"Concepts"},{"key":"price","label":"Pricing"},{"key":"boundary","label":"Limits"},{"key":"industry","label":"Industry"},{"key":"practice","label":"Practice"},{"key":"safety","label":"Safety"}],"tiers":[{"min":12,"name":"Pro 9-dan","comment":"A perfect score — even the quiz author nods."},{"min":11,"name":"Pro 3-dan","comment":"This question bank is barely a challenge anymore."},{"min":10,"name":"Pro 1-dan","comment":"Ahead of 90% of readers; you can teach your colleagues."},{"min":9,"name":"Amateur 5-dan","comment":"AI already has a desk in your workflow."},{"min":8,"name":"Amateur 4-dan","comment":"Clear on pricing and limits — AI can't fool you easily."},{"min":6,"name":"Amateur 3-dan","comment":"Your prompts have real structure; fundamentals solid."},{"min":4,"name":"Amateur 2-dan","comment":"You know where it shines and where it fails."},{"min":2,"name":"Amateur 1-dan","comment":"You've started searching with AI — first step taken."},{"min":0,"name":"Outsider","comment":"It's windy outside the AI gate — come in and sit down."}],"weakLinks":{"price":{"href":"../cost/","text":"Brush up in the cost calculator →"},"industry":{"href":"../models/","text":"Brush up in the model library →"},"practice":{"href":"../prompts/","text":"Brush up in the prompt library →"},"concept":{"href":"../about/","text":"Read the data & methodology notes →"},"boundary":{"href":"../about/","text":"Read the data & methodology notes →"},"safety":{"href":"../about/","text":"Read the data & methodology notes →"}}};
window.QUIZ_EN_UI = {
  progress: function (i, n) { return 'Question ' + i + ' / ' + n; },
  correct: "Correct", wrong: "Incorrect",
  next: "Next question", result: "See results",
  score: function (s, n) { return 'Score ' + s + ' / ' + n; },
  percentile: function (p) { return 'Better than ' + p + '% of readers (estimated from a reference model)'; },
  copyDone: "Copied — paste it anywhere", copyBtn: "Copy result text", copyFail: "Copy failed, take a screenshot",
  posterTitle: "AI Literacy Rank Test", posterSub: "12 questions · six dimensions · instant explanations",
  posterScan: "Scan to test your rank", posterNote: "For fun only",
  share: function (tier, p) { return 'My AI literacy rank is "' + tier + '", better than ' + p + '% of readers. Beat that → reflex-hub.com/en/quiz'; },
  start: "Start the test", loadFail: "Failed to load questions — please refresh"
};
