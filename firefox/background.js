(browser.action || browser.browserAction).onClicked.addListener(function () {
  browser.tabs.create({ url: "https://hangar.link" });
});

function getRsiToken() {
  return new Promise((resolve, reject) => {
    browser.cookies.get({url:"https://robertsspaceindustries.com/",name:"Rsi-Token"},
      function (cookie) {
        if (cookie) {
          resolve(cookie.value)
        }
        else {
          resolve(null);
        }
    })
  });
}

function rsiJSONPost(params) {
  return new Promise((resolve, reject) => {
    rsiJSONPostInt(params, function(data) {
      resolve(data);
    })
  }
)};

function rsiJSONPostInt(params, onComplete) {
  var url = params.url;
  var payload = params.payload;
  var rsiToken = params.rsiToken;
  var timeout = params.timeout || 10000;
  var rsiUTF8 = !!params.rsiUTF8;
  var xhr = new XMLHttpRequest();
  xhr.open("POST", url, true);
  if (rsiUTF8) {
    xhr.setRequestHeader("Content-type", 'application/json;charset=UTF-8');
    xhr.setRequestHeader("Accept", 'application/json;charset=UTF-8');
  } else {
    xhr.setRequestHeader("Content-type", 'application/json');
    xhr.setRequestHeader("Accept", '*/*');
  }
  xhr.setRequestHeader("Accept-Language", 'en-GB,en-US;q=0.9,en;q=0.8');
  xhr.setRequestHeader("X-Rsi-Token", rsiToken);
  xhr.withCredentials = true;
  xhr.timeout = timeout;
  xhr.onreadystatechange = function() {
    if (xhr.readyState == 4) {
      onComplete({code: xhr.status, body: xhr.responseText});
    }
  }
  var jsonDataParam;
  if (payload !== null && payload !== undefined) {
    if (typeof payload === 'string') {
      jsonDataParam = payload;
    } else {
      jsonDataParam = JSON.stringify(payload)
    }
  }
  xhr.send(jsonDataParam);
};

function rsiHTMLGet(params) {
  return new Promise((resolve, reject) => {
    rsiHTMLGetInt(params,  function(data) {
      resolve(data);
    })
  }
)};

function rsiHTMLGetInt(params, onComplete) {
  var url = params.url;
  var timeout = params.timeout || 10000;
  var xhr = new XMLHttpRequest();
  xhr.open("GET", url, true);
  xhr.setRequestHeader("accept", 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9');
  xhr.setRequestHeader("accept-language", 'en-GB,en-US;q=0.9,en;q=0.8');
  xhr.setRequestHeader("cache-control", 'max-age=0');
  xhr.withCredentials = true;
  xhr.timeout = timeout;
  xhr.onreadystatechange = function() {
    if (xhr.readyState == 4) {
      onComplete({code: xhr.status, body: xhr.responseText});
    }
  }
  xhr.send();
};

async function identify(token) {
  var response = await rsiJSONPost({url: 'https://robertsspaceindustries.com/api/spectrum/auth/identify', payload: {}, rsiToken: token});
  return response;
};

async function getPledgesPage(page) {

  const url = 'https://robertsspaceindustries.com/account/pledges';
  var params = ""
  if (page > 1) {
    params = "?page=" + page.toString()
  }
  var response = await rsiHTMLGet({url: url + params});
  return response;
}

async function getBuybacksPage(page) {
  const url = 'https://robertsspaceindustries.com/account/buy-back-pledges';
  var params = "?page=" + page.toString() + "&pagesize=100";
  var response = await rsiHTMLGet({url: url + params});
  return response;
}

async function getBuybackPage(pledgeId) {
  var response = await rsiHTMLGet({url: 'https://robertsspaceindustries.com/pledge/buyback/' + pledgeId});
  return response;
}

async function setAuthToken(token) {
  var response = await rsiJSONPost({url: 'https://robertsspaceindustries.com/api/account/v2/setAuthToken', payload: {}, rsiToken: token});
  return response;
};

async function setContextTokenBuyback(fromShipId, toShipId, toSkuId, pledgeId, token) {
  var payload = {"fromShipId":fromShipId,"toShipId":toShipId,"toSkuId":toSkuId,"pledgeId":pledgeId}
  var response = await rsiJSONPost({url: 'https://robertsspaceindustries.com/api/ship-upgrades/setContextToken', payload: payload, rsiToken: token});
  return response;
};

async function setContextToken(fromShipId, toShipId, toSkuId, pledgeId, token) {
  var payload = {}
  var response = await rsiJSONPost({url: 'https://robertsspaceindustries.com/api/ship-upgrades/setContextToken', payload: payload, rsiToken: token});
  return response;
};

async function getPrices(fromShipId, toSkuId, token) {
  payload = [{"operationName":"getPrice","variables":{"from":fromShipId,"to":toSkuId},"query":"query getPrice($from: Int!, $to: Int!) {\n  price(from: $from, to: $to) {\n    amount\n    nativeAmount\n  }\n}\n"},{"operationName":"filterShips","variables":{"fromId":fromShipId,"toId":toSkuId,"fromFilters":[],"toFilters":[]},"query":"query filterShips($fromId: Int, $toId: Int, $fromFilters: [FilterConstraintValues], $toFilters: [FilterConstraintValues]) {\n  from(to: $toId, filters: $fromFilters) {\n    ships {\n      id\n    }\n  }\n  to(from: $fromId, filters: $toFilters) {\n    ships {\n      id\n    }\n    }\n}"}];
  var response = await rsiJSONPost({url: 'https://robertsspaceindustries.com/pledge-store/api/upgrade/graphql', payload: payload, rsiToken: token});
  return response;
};

async function onMessage(rawMessage) {
  console.log("in on message");
  var message = JSON.parse(rawMessage || "{}");

  if (message?.action == "connect") {
      return JSON.stringify({code: 200, version: 1});

  } else if (message?.action == "identify") {
    var token = await getRsiToken();
    if (!token) {
      return JSON.stringify({code: 400, error: "Token not found" + message?.action});
    } else {
      var response = await identify(token);
      var payload;
      if (response.code == 200) {
        payload = {handle: JSON.parse(response.body)?.data?.member?.displayname}
      } else {
        payload = {error: response.body};
      }

      return JSON.stringify({code: response.code, payload: payload});
    }

  } else if (message?.action == "getPledgesPage") {
    var page = message?.page;
    if (!!isNaN(page)) {
      return JSON.stringify({code: 400, error: "Invalid page " + message?.action});
    } else {
      var response = await getPledgesPage(page);
      return JSON.stringify({code: response.code, payload: response.body});
    }

  } else if (message?.action == "getBuybacksPage") {
    var page = message?.page;
    if (!!isNaN(page)) {
      return JSON.stringify({code: 400, error: "Invalid page " + message?.action});
    } else {
      var response = await getBuybacksPage(page);
      return JSON.stringify({code: response.code, payload: response.body});
    }

  } else if (message?.action == "getBuybackPage") {
    var pledgeId = message?.pledgeId;
    if (!!isNaN(pledgeId)) {
      return JSON.stringify({code: 400, error: "Invalid pledgeId " + message?.action});
    } else {
      var response = await getBuybackPage(pledgeId);
      return JSON.stringify({code: response.code, payload: response.body});
    }

  } else if (message?.action == "setAuthToken") {
    var token = await getRsiToken();
    if (!token) {
      return JSON.stringify({code: 400, error: "Token not found " + message?.action});
    } else {
      var response = await setAuthToken(token);
      return JSON.stringify({code: response.code, payload: response.body});
    }

  } else if (message?.action == "setContextTokenBuyback") {
    var token = await getRsiToken();
    if (!token) {
      return JSON.stringify({code: 400, error: "Token not found" + message?.action});
    } else {
      var fromShipId = message?.fromShipId;
      var toShipId = message?.toShipId;
      var toSkuId = message?.toSkuId;
      var pledgeId = message?.pledgeId;
      if (!!isNaN(fromShipId) || !!isNaN(toShipId) || !!isNaN(toSkuId) || !!isNaN(pledgeId)) {
        return JSON.stringify({code: 400, error: "Token not found" + message?.action});
      } else {
        var response = await setContextTokenBuyback(fromShipId, toShipId, toSkuId, pledgeId, token);
        return JSON.stringify({code: response.code, payload: response.body});
      }
    }

  } else if (message?.action == "setContext") {
    var token = await getRsiToken();
    if (!token) {
      return JSON.stringify({code: 400, error: "Token not found" + message?.action});
    } else {
      var response = await setContextToken(token);
      return JSON.stringify({code: response.code, payload: response.body});
      
    }

  } else if (message?.action == "getUpgradePrice") {
    var token = await getRsiToken();
    if (!token) {
      return JSON.stringify({code: 400, error: "Token not found " + message?.action});
    } else {
      var fromShipId = message?.fromShipId;
      var toSkuId = message?.toSkuId; 
      if (!!isNaN(fromShipId) || !!isNaN(toSkuId)) {
        return JSON.stringify({code: 400, error: "Parameter error " + message?.action});
      } else {
        var response = await getPrices(fromShipId, toSkuId, token);
        return JSON.stringify({code: response.code, payload: response.body});
      }
    }

  } else {
    return JSON.stringify({code: 500, error: "Unknown Action " + message?.action});
  }
}

function eventHandler(message, sender, response) {
  console.log("returning onMessage");
  // must return a promise.
  return onMessage(message);
}
browser.runtime.onMessage.addListener(eventHandler);
