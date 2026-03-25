function goTo(page) {
  alert("Navigate to " + page);
}

function startLearning() {
  alert("Starting your journey!");
}

function customCourse() {
  alert("Customize your course!");
}

function generateRoadmap() {
  const goal = document.getElementById("goalInput").value;
  const output = document.getElementById("roadmapOutput");

  if (!goal) {
    output.innerHTML = "Please enter a goal.";
    return;
  }

  output.innerHTML = `
    <h3>Roadmap for ${goal}</h3>
    <ul>
      <li>Step 1: Basics</li>
      <li>Step 2: Intermediate Concepts</li>
      <li>Step 3: Projects</li>
      <li>Step 4: Advanced Topics</li>
    </ul>
  `;
}

let progress = 0;
setInterval(() => {
  if (progress < 70) {
    progress++;
    document.getElementById("progressFill").style.width = progress + "%";
    document.getElementById("progressText").innerText = progress + "% Complete";
  }
}, 100);
