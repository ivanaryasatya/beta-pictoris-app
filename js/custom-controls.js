
// ===== CUSTOM CONTROL =====
function toggleSliderConfig() {
    const type = document.getElementById("controlType").value;
    const config = document.getElementById("sliderConfig");
    config.style.display = (type === "slider") ? "block" : "none";
}

function createControl() {
    let name = document.getElementById("cmdName").value;
    let cType = document.getElementById("controlType").value;
    let sMode = document.getElementById("sendMode").value;

    if (name.trim() === "") return alert("Isi nama command!");

    let container = document.createElement("div");
    container.style.background = "#334155";
    container.style.padding = "10px";
    container.style.borderRadius = "5px";
    container.style.display = "flex";
    container.style.alignItems = "center";
    container.style.gap = "10px";

    // Label
    let label = document.createElement("strong");
    label.innerText = name + ": ";
    container.appendChild(label);

    if (cType === "boolean") {
        let btn = document.createElement("button");
        btn.innerText = "OFF";
        btn.style.background = "#ef4444";
        btn.style.width = "60px";

        let state = 0;
        btn.onclick = function () {
            state = state ? 0 : 1; // Toggle
            btn.innerText = state ? "ON" : "OFF";
            btn.style.background = state ? "#22c55e" : "#ef4444";

            if (sMode === "instant") {
                sendCommand(name + ":" + state);
            }
        };

        container.appendChild(btn);

        if (sMode === "manual") {
            let sendBtn = document.createElement("button");
            sendBtn.innerText = "Send";
            sendBtn.onclick = function () { sendCommand(name + ":" + state); };
            container.appendChild(sendBtn);
        }
    }
    else if (cType === "slider") {
        let min = document.getElementById("slideMin").value;
        let max = document.getElementById("slideMax").value;
        let step = document.getElementById("slideStep").value;

        let slider = document.createElement("input");
        slider.type = "range";
        slider.min = min;
        slider.max = max;
        slider.step = step;
        slider.value = min;

        let val = document.createElement("span");
        val.innerText = min;

        slider.oninput = function () {
            val.innerText = slider.value;
        };
        slider.onchange = function () {
            if (sMode === "instant") sendCommand(name + ":" + slider.value);
        };

        container.appendChild(slider);
        container.appendChild(val);

        if (sMode === "manual") {
            let sendBtn = document.createElement("button");
            sendBtn.innerText = "Send";
            sendBtn.onclick = function () { sendCommand(name + ":" + slider.value); };
            container.appendChild(sendBtn);
        }
    }
    else if (cType === "text" || cType === "number") {
        let input = document.createElement("input");
        input.type = (cType === "text") ? "text" : "number";
        input.placeholder = "Value";
        input.style.width = "100px";

        let sendBtn = document.createElement("button");
        sendBtn.innerText = "Send";
        sendBtn.onclick = function () {
            sendCommand(name + ":" + input.value);
        };

        container.appendChild(input);
        container.appendChild(sendBtn);
    }

    // Add delete button
    let delBtn = document.createElement("button");
    delBtn.innerText = "X";
    delBtn.style.background = "#ef4444";
    delBtn.style.padding = "4px 8px";
    delBtn.onclick = function () {
        container.remove();
    };
    container.appendChild(delBtn);

    document.getElementById("customControls").appendChild(container); // Add to DOM

    // Reset name input only, keep settings for ease of bulk create
    document.getElementById("cmdName").value = "";
}
