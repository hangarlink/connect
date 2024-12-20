function handleResponse(response) {
  window.postMessage({
    direction: "from-hangar-link-connect",
    message: response,
  }, "https://hangar.link");
}

window.addEventListener("message", (event) => {
  if (event.source == window &&
      event.data &&
      event.data.direction == "from-hangar-link") {
    (chrome || browser).runtime.sendMessage(event.data.message,
      function(response) {
        handleResponse(response);
      }
    );
  }
});
