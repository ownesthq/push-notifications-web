import { launchServer, createChromeWebDriver } from './test-utils';

let killServer = null;
let chromeDriver = null;

beforeAll(() => {
  return launchServer()
    .then(killFunc => {
      killServer = killFunc;
    })
    .then(() => createChromeWebDriver())
    .then(driver => {
      chromeDriver = driver;
    });
});

test('SDK should register a device with errol', async () => {
  await chromeDriver.get('http://localhost:3000');
  await chromeDriver.wait(() => {
    return chromeDriver.getTitle().then(title => title.includes('Test Page'));
  }, 2000);

  const initialDeviceId = await chromeDriver.executeAsyncScript(() => {
    const asyncScriptReturnCallback = arguments[arguments.length - 1];

    const instanceId = 'deadc0de-2ce6-46e3-ad9a-5c02d0ab119b';
    return PusherPushNotifications.init({ instanceId })
      .then(beamsClient => beamsClient.start())
      .then(beamsClient => asyncScriptReturnCallback(beamsClient.deviceId))
      .catch(e => asyncScriptReturnCallback(e.message));
  });

  expect(initialDeviceId).toContain('web-');
});

test('SDK should remember the device ID', async () => {
  await chromeDriver.get('http://localhost:3000');
  await chromeDriver.wait(() => {
    return chromeDriver.getTitle().then(title => title.includes('Test Page'));
  }, 2000);

  const initialDeviceId = await chromeDriver.executeAsyncScript(() => {
    const asyncScriptReturnCallback = arguments[arguments.length - 1];

    const instanceId = 'deadc0de-2ce6-46e3-ad9a-5c02d0ab119b';
    return PusherPushNotifications.init({ instanceId })
      .then(beamsClient => beamsClient.start())
      .then(beamsClient => asyncScriptReturnCallback(beamsClient.deviceId))
      .catch(e => asyncScriptReturnCallback(e.message));
  });

  await chromeDriver.get('http://localhost:3000');
  await chromeDriver.wait(() => {
    return chromeDriver.getTitle().then(title => title.includes('Test Page'));
  }, 2000);

  const reloadedDeviceId = await chromeDriver.executeAsyncScript(() => {
    const asyncScriptReturnCallback = arguments[arguments.length - 1];

    const instanceId = 'deadc0de-2ce6-46e3-ad9a-5c02d0ab119b';
    return PusherPushNotifications.init({ instanceId })
      .then(beamsClient => beamsClient.start())
      .then(beamsClient => asyncScriptReturnCallback(beamsClient.deviceId))
      .catch(e => asyncScriptReturnCallback(e.message));
  });

  expect(reloadedDeviceId).toBe(initialDeviceId);
});


test('SDK should register a device with errol without registering the service worker itself', async () => {
  // this is the case where customers want to manage the service worker themselves
  await chromeDriver.get('http://localhost:3000');
  await chromeDriver.wait(() => {
    return chromeDriver.getTitle().then(title => title.includes('Test Page'));
  }, 2000);

  // make sure there device isn't there
  await chromeDriver.executeAsyncScript(() => {
    const asyncScriptReturnCallback = arguments[arguments.length - 1];

    let deleteDbRequest = window.indexedDB.deleteDatabase(
      'beams-deadc0de-2ce6-46e3-ad9a-5c02d0ab119b'
    );
    deleteDbRequest.onsuccess = asyncScriptReturnCallback;
    deleteDbRequest.onerror = asyncScriptReturnCallback;
  });
  const initialDeviceId = await chromeDriver.executeAsyncScript(() => {
    const asyncScriptReturnCallback = arguments[arguments.length - 1];

    const instanceId = 'deadc0de-2ce6-46e3-ad9a-5c02d0ab119b';
    return PusherPushNotifications.init({
      serviceWorkerRegistration: window.navigator.serviceWorker.register('/service-worker.js'),
      instanceId,
    })
      .then(beamsClient => beamsClient.start())
      .then(beamsClient => asyncScriptReturnCallback(beamsClient.deviceId))
      .catch(e => asyncScriptReturnCallback(e.message));
  });

  expect(initialDeviceId).toContain('web-');
});

afterAll(() => {
  if (killServer) {
    killServer();
  }
  if (chromeDriver) {
    chromeDriver.quit();
  }
});
