const _ = require('lodash');
const querystring = require('querystring');
const axios = require('axios');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const Settings = require('./settings');
const User = require('./user');

dayjs.extend(utc);

const providerTokenUri = {
  google: 'https://www.googleapis.com/oauth2/v4/token',
  instagram: 'https://api.instagram.com/oauth/access_token',
  vimeo: 'https://api.vimeo.com/oauth/access_token',
  spotify: 'https://accounts.spotify.com/api/token',
};

class Provider {
  constructor(appConfig) {
    this.appConfig = appConfig;

    return this;
  }

  async auth(
    providerSlug,
    providerSettings,
    { refresh = false, code = undefined }
  ) {
    const providerConfig = this.appConfig.provider[providerSlug];

    const data = {
      grant_type: refresh ? 'refresh_token' : 'authorization_code',
      code,
      client_id: providerConfig.clientId,
      client_secret: providerConfig.clientSecret,
      redirect_uri: providerConfig.redirectUri,
      refresh_token: refresh ? providerSettings.refresh_token : undefined,
    };

    const uri = providerTokenUri[providerSlug];

    let providerAuthResult;

    try {
      providerAuthResult = (await axios.post(uri, querystring.stringify(data)))
        .data;
    } catch (error) {
      throw Error(JSON.stringify(error.response.data));
    }

    providerSettings = _.merge({}, providerSettings, providerAuthResult);

    if (providerAuthResult.expires_in) {
      providerSettings.expires = dayjs()
        .add(parseInt(providerAuthResult.expires_in, 10), 'seconds')
        .utc()
        .format();
    }

    if (providerSlug === 'google') {
      try {
        providerSettings.user = (
          await axios.get(
            `https://www.googleapis.com/plus/v1/people/me?access_token=${providerSettings.access_token}`
          )
        ).data;
      } catch (error) {
        console.error(error);
      }
    }

    if (providerSlug === 'spotify') {
      try {
        providerSettings.user = (
          await axios.get(
            `https://api.spotify.com/v1/me?access_token=${providerSettings.access_token}`
          )
        ).data;
      } catch (error) {
        console.error(error);
      }
    }

    return providerSettings;
  }

  async settings(providerSlug, { userId = undefined, forceRefresh = false }) {
    let providerSettings;

    let userObject;
    let settingsObject;

    const user = new User(this.appConfig);
    const settings = new Settings(this.appConfig);

    if (userId) {
      userObject = (await user.read(userId))[userId];
      providerSettings = userObject.settings.provider[providerSlug];
    } else {
      settingsObject = await settings.read();
      providerSettings = settingsObject.provider[providerSlug];
    }

    let updatedUser;
    let updatedSettings;

    if (
      new Date(dayjs().utc().format()).getTime() >
        new Date(_.get(providerSettings, 'expires', 0)).getTime() ||
      forceRefresh
    ) {
      try {
        providerSettings = await this.auth(providerSlug, providerSettings, {
          refresh: true,
        });

        if (userId) {
          updatedUser = await user.update(
            _.merge({}, userObject, {
              settings: {
                provider: {
                  [providerSlug]: providerSettings,
                },
              },
            })
          );
        } else {
          updatedSettings = await settings.update(
            _.merge({}, settingsObject, {
              provider: {
                [providerSlug]: providerSettings,
              },
            })
          );
        }
      } catch (error) {
        console.error(error);
      }
    }

    return { providerSettings, updatedUser, updatedSettings };
  }
}

module.exports = Provider;
