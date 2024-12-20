((chrome || browser).action || (chrome || browser).browserAction).onClicked.addListener(function () {
  (chrome || browser).tabs.create({ url: "https://hangar.link" });
});

function getRsiToken() {
  return new Promise((resolve, reject) => {
    (chrome || browser).cookies.get({url:"https://robertsspaceindustries.com/",name:"Rsi-Token"},
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

async function rsiJSONPost(params) {
  var url = params.url;
  var payload = params.payload;
  var rsiToken = params.rsiToken;
  var timeout = params.timeout || 10000;
  var rsiUTF8 = !!params.rsiUTF8;
 
  var jsonDataParam;
  if (payload !== null && payload !== undefined) {
    if (typeof payload === 'string') {
      jsonDataParam = payload;
    } else {
      jsonDataParam = JSON.stringify(payload)
    }
  }

  var headers = {
    "Accept-Language": "en-GB,en-US;q=0.9,en;q=0.8",
    "X-Rsi-Token": rsiToken,
    "Content-type": "application/json",
    "Accept": "*/*"
  };

  if (rsiUTF8) {
    headers["Content-type"] = "application/json;charset=UTF-8";
    headers["Accept"] =  "application/json;charset=UTF-8";
  }

  var req = {
    method: "POST",
    credentials: "include",
    headers: headers,
    redirect: "manual",
    referrerPolicy: "strict-origin-when-cross-origin",
    body: jsonDataParam
  }
  
  var response = await fetch(url, req);
  return ({code: response.status, body: await response.text()});
};

async function rsiHTMLGet(params) {
  var url = params.url;
  var timeout = params.timeout || 10000;
  var headers = {
    "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
    "accept-language": "en-GB,en-US;q=0.9,en;q=0.8",
    "cache-control": "max-age=0",
  };
  var req = {
    method: "GET",
    headers: headers,
    credentials: "include",
  };
  var response = await fetch(url, req);
  return ({code: response.status, body: await response.text()});
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

async function setContextToken(token) {
  var payload = {}
  var response = await rsiJSONPost({url: 'https://robertsspaceindustries.com/api/ship-upgrades/setContextToken', payload: payload, rsiToken: token});
  return response;
};

async function getPrices(fromShipId, toSkuId, token) {
  payload = [{"operationName":"getPrice","variables":{"from":fromShipId,"to":toSkuId},"query":"query getPrice($from: Int!, $to: Int!) {\n  price(from: $from, to: $to) {\n    amount\n    nativeAmount\n  }\n}\n"},{"operationName":"filterShips","variables":{"fromId":fromShipId,"toId":toSkuId,"fromFilters":[],"toFilters":[]},"query":"query filterShips($fromId: Int, $toId: Int, $fromFilters: [FilterConstraintValues], $toFilters: [FilterConstraintValues]) {\n  from(to: $toId, filters: $fromFilters) {\n    ships {\n      id\n    }\n  }\n  to(from: $fromId, filters: $toFilters) {\n    ships {\n      id\n    }\n    }\n}"}];
  var response = await rsiJSONPost({url: 'https://robertsspaceindustries.com/pledge-store/api/upgrade/graphql', payload: payload, rsiToken: token});
  return response;
};

async function reclaimPledge(pledgeId, currentPassword, token) {
  payload = {"pledge_id": pledgeId, "current_password": currentPassword};
  var response = await rsiJSONPost({url: 'https://robertsspaceindustries.com/api/account/reclaimPledge', payload: payload, rsiToken: token});
  return response;
}

async function addCartItem(skuId, quantity, token) {
  payload = [{"operationName":"AddCartItemMutation","variables":{"skuId":skuId,"qty":quantity,"identifier":null},"query":"mutation AddCartItemMutation($skuId: ID!, $qty: Int!, $identifier: String) {\n  store(name: \"pledge\") {\n    cart {\n      mutations {\n        add(skuId: $skuId, qty: $qty, identifier: $identifier)\n        __typename\n      }\n      __typename\n    }\n    __typename\n  }\n}\n"}]
  var response = await rsiJSONPost({url: 'https://robertsspaceindustries.com/graphql', payload: payload, rsiToken: token});
  return response;
};

async function onMessage(rawMessage, sendResponse) {
  var message = JSON.parse(rawMessage || "{}");

  if (message?.action == "connect") {
    sendResponse(JSON.stringify({code: 200, versionMajor: 1, versionMinor: 7}));

  } else if (message?.action == "identify") {
    var token = await getRsiToken();
    if (!token) {
      sendResponse(JSON.stringify({code: 400, error: "Token not found" + message?.action}));
    } else {
      var response = await identify(token);
      var payload;
      if (response.code == 200) {
        payload = {handle: JSON.parse(response.body)?.data?.member?.nickname}
      } else {
        payload = {error: response.body};
      }

      sendResponse(JSON.stringify({code: response.code, payload: payload}));
    }

  } else if (message?.action == "getPledgesPage") {
    var page = message?.page;
    if (!!isNaN(page)) {
      sendResponse(JSON.stringify({code: 400, error: "Invalid page " + message?.action}));
    } else {
      var response = await getPledgesPage(page);
      sendResponse(JSON.stringify({code: response.code, payload: response.body}));
    }

  } else if (message?.action == "getBuybacksPage") {
    var page = message?.page;
    if (!!isNaN(page)) {
      sendResponse(JSON.stringify({code: 400, error: "Invalid page " + message?.action}));
    } else {
      var response = await getBuybacksPage(page);
      sendResponse(JSON.stringify({code: response.code, payload: response.body}));
    }

  } else if (message?.action == "getBuybackPage") {
    var pledgeId = message?.pledgeId;
    if (!!isNaN(pledgeId)) {
      sendResponse(JSON.stringify({code: 400, error: "Invalid pledgeId " + message?.action}));
    } else {
      var response = await getBuybackPage(pledgeId);
      sendResponse(JSON.stringify({code: response.code, payload: response.body}));
    }

  } else if (message?.action == "setAuthToken") {
    var token = await getRsiToken();
    if (!token) {
      sendResponse(JSON.stringify({code: 400, error: "Token not found " + message?.action}));
    } else {
      var response = await setAuthToken(token);
      sendResponse(JSON.stringify({code: response.code, payload: response.body}));
    }

  } else if (message?.action == "setContextTokenBuyback") {
    var token = await getRsiToken();
    if (!token) {
      sendResponse(JSON.stringify({code: 400, error: "Token not found" + message?.action}));
    } else {
      var fromShipId = message?.fromShipId;
      var toShipId = message?.toShipId;
      var toSkuId = message?.toSkuId;
      var pledgeId = message?.pledgeId;
      if (!!isNaN(fromShipId) || !!isNaN(toShipId) || !!isNaN(toSkuId) || !!isNaN(pledgeId)) {
        sendResponse(JSON.stringify({code: 400, error: "Token not found" + message?.action}));
      } else {
        var response = await setContextTokenBuyback(fromShipId, toShipId, toSkuId, pledgeId, token);
        sendResponse(JSON.stringify({code: response.code, payload: response.body}));
      }
    }

  } else if (message?.action == "setContextToken") {
    var token = await getRsiToken();
    if (!token) {
      sendResponse(JSON.stringify({code: 400, error: "Token not found" + message?.action}));
    } else {
      var response = await setContextToken(token);
      sendResponse(JSON.stringify({code: response.code, payload: response.body}));
      
    }

  } else if (message?.action == "getUpgradePrice") {
    var token = await getRsiToken();
    if (!token) {
      sendResponse(JSON.stringify({code: 400, error: "Token not found " + message?.action}));
    } else {
      var fromShipId = message?.fromShipId;
      var toSkuId = message?.toSkuId; 
      if (!!isNaN(fromShipId) || !!isNaN(toSkuId)) {
        sendResponse(JSON.stringify({code: 400, error: "Parameter error " + message?.action}));
      } else {
        var response = await getPrices(fromShipId, toSkuId, token);
        sendResponse(JSON.stringify({code: response.code, payload: response.body}));
      }
    }

  } else if (message?.action == "reclaimPledge") {
    var token = await getRsiToken();
    if (!token) {
      sendResponse(JSON.stringify({code: 400, error: "Token not found " + message?.action}));
    } else {
      var pledgeId = message?.pledgeId;
      var currentPassword = message?.currentPassword;
      if ((pledgeId || "") == "" || (currentPassword || "") == "") {
        sendResponse(JSON.stringify({code: 400, error: "Parameter error " + message?.action}));
      } else {
        var response = await reclaimPledge(pledgeId, currentPassword, token);
        sendResponse(JSON.stringify({code: response.code, payload: response.body}));
      }
    }

  } else if (message?.action == "addCartItem") {
    var token = await getRsiToken();
    if (!token) {
      sendResponse(JSON.stringify({code: 400, error: "Token not found " + message?.action}));
    } else {
      var skuId = message?.skuId;
      var quantity = message?.quantity;
      if ((skuId || "") == "" || (!!isNaN(quantity))) {
        sendResponse(JSON.stringify({code: 400, error: "Parameter error " + message?.action}));
      } else {
        var response = await addCartItem(skuId, quantity, token);
        sendResponse(JSON.stringify({code: response.code, payload: response.body}));
      }
    }

  } else {
    sendResponse(JSON.stringify({code: 500, error: "Unknown Action " + message?.action}));
  }
}

(chrome || browser).runtime.onMessage.addListener(
    function(message, sender, sendResponse) {
      onMessage(message, sendResponse);
      return true;
  });
