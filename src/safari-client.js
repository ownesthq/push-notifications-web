import doRequest from './do-request';
import BaseClient from './base-client';
import { version as sdkVersion } from '../package.json';
import { RegistrationState } from './base-client';

const __url = 'https://localhost:8080';
const __pushId = 'web.io.lees.safari-push';

const platform = 'safari';

export class SafariClient extends BaseClient {
  constructor(config) {
    super(config, platform);
    if (!isSupportedBrowser()) {
      throw new Error(
        'Pusher Beams does not support this Safari version (Safari Push Notifications not supported)'
      );
    }

    this._ready = this._init();
  }

  async _init() {
    this._websitePushId = await this._fetchWebsitePushId();
    this._serviceUrl = __url;

    if (this._deviceId !== null) {
      return;
    }

    await this._deviceStateStore.connect();
    await this._detectSubscriptionChange();

    this._deviceId = await this._deviceStateStore.getDeviceId(
      this._websitePushId
    );
    this._token = await this._deviceStateStore.getToken();
    this._userId = await this._deviceStateStore.getUserId();
  }

  async _detectSubscriptionChange() {
    const storedToken = await this._deviceStateStore.getToken();
    const actualToken = getDeviceToken(this._websitePushId);

    const tokenHasChanged = storedToken !== actualToken;
    if (tokenHasChanged) {
      // The device token has changed. This is should only really happen when
      // users restore from an iCloud backup
      await this._deviceStateStore.clear();
      this._deviceId = null;
      this._token = null;
      this._userId = null;
    }
  }

  _requestPermission() {
    return new Promise(resolve => {
      window.safari.pushNotification.requestPermission(
        this._serviceUrl,
        this._websitePushId,
        { userID: 'abcdef' },
        resolve
      );
    });
  }

  async start() {
    await this.ready;

    if (this._deviceId !== null) {
      return this;
    }

    let { permission } = getPermission(this._websitePushId);

    if (permission === 'default') {
      console.debug('permission is default, requesting permission');
      let { deviceToken, permission } = await this._requestPermission(
        this._websitePushId
      );
      if (permission == 'granted') {
        const deviceId = await this._registerDevice(
          deviceToken,
          this._websitePushId
        );
        await this._deviceStateStore.setToken(deviceToken);
        await this._deviceStateStore.setDeviceId(deviceId);
        await this._deviceStateStore.setLastSeenSdkVersion(sdkVersion);
        await this._deviceStateStore.setLastSeenUserAgent(
          window.navigator.userAgent
        );
        this._token = deviceToken;
        this._deviceId = deviceId;
      }
    }
  }

  async getRegistrationState() {
    await this._resolveSDKState();

    const { permission } = getPermission(this._websitePushId);

    if (permission === 'denied') {
      return RegistrationState.PERMISSION_DENIED;
    }

    if (permission === 'granted' && this._deviceId !== null) {
      return RegistrationState.PERMISSION_GRANTED_REGISTERED_WITH_BEAMS;
    }

    if (permission === 'granted' && this._deviceId === null) {
      return RegistrationState.PERMISSION_GRANTED_NOT_REGISTERED_WITH_BEAMS;
    }

    return RegistrationState.PERMISSION_PROMPT_REQUIRED;
  }

  async clearAllState() {
    // TODO we can only call start() in a user gesture so this may not work in
    // safari, can't we clear the state another way
    throw new Error('Not implemented');
    // if (!isSupportedBrowser()) {
    //   return;
    // }

    // await this.stop();
    // await this.start();
  }

  // TODO these seem similar enough to go in the base client but
  // isSupportedBrowser is going to be different for safari/web-push. It's not
  // clear to me at the moment why we need to check whether the browser is
  // supported here anyway
  async setUserId(userId, tokenProvider) {
    await this._resolveSDKState();

    if (!isSupportedBrowser()) {
      return;
    }

    if (this._deviceId === null) {
      const error = new Error('.start must be called before .setUserId');
      return Promise.reject(error);
    }
    if (typeof userId !== 'string') {
      throw new Error(`User ID must be a string (was ${userId})`);
    }
    if (userId === '') {
      throw new Error('User ID cannot be the empty string');
    }
    if (this._userId !== null && this._userId !== userId) {
      throw new Error('Changing the `userId` is not allowed.');
    }

    const path = `${this._baseURL}/device_api/v1/instances/${encodeURIComponent(
      this.instanceId
    )}/devices/web/${this._deviceId}/user`;

    const { token: beamsAuthToken } = await tokenProvider.fetchToken(userId);
    const options = {
      method: 'PUT',
      path,
      headers: {
        Authorization: `Bearer ${beamsAuthToken}`,
      },
    };
    await doRequest(options);

    this._userId = userId;
    return this._deviceStateStore.setUserId(userId);
  }

  async stop() {
    await this._resolveSDKState();

    if (!isSupportedBrowser()) {
      return;
    }

    if (this._deviceId === null) {
      return;
    }

    await this._deleteDevice();
    await this._deviceStateStore.clear();
    this._clearPushToken().catch(() => {}); // Not awaiting this, best effort.

    this._deviceId = null;
    this._token = null;
    this._userId = null;
  }

  async _registerDevice(token, websitePushId) {
    return await super._registerDevice({
      token,
      websitePushId,
      metadata: {
        sdkVersion,
      },
    });
  }

  _fetchWebsitePushId() {
    return new Promise(resolve => {
      // TODO temporary
      resolve(__pushId);
    });
  }
}

function isSupportedBrowser() {
  return 'safari' in window && 'pushNotification' in window.safari;
}

function getPermission(pushId) {
  return window.safari.pushNotification.permission(pushId);
}
function getDeviceToken(websitePushId) {
  const { deviceToken } = window.safari.pushNotification.permission(
    websitePushId
  );
  return deviceToken;
}
