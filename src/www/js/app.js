/* eslint-disable no-console */
/* eslint-disable no-alert */
/* eslint-disable no-undef */
/* eslint-disable no-new */

'use strict';

function bytes(bytes, decimals, kib, maxunit) {
  kib = kib || false;
  if (bytes === 0) return '0 B';
  if (Number.isNaN(parseFloat(bytes)) && !Number.isFinite(bytes)) return 'NaN';
  const k = kib ? 1024 : 1000;
  const dm = decimals != null && !Number.isNaN(decimals) && decimals >= 0 ? decimals : 2;
  const sizes = kib
    ? ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB', 'BiB']
    : ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB', 'BB'];
  let i = Math.floor(Math.log(bytes) / Math.log(k));
  if (maxunit !== undefined) {
    const index = sizes.indexOf(maxunit);
    if (index !== -1) i = index;
  }
  // eslint-disable-next-line no-restricted-properties
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

new Vue({
  el: '#app',
  data: {
    authenticated: null,
    authenticating: false,
    password: null,
    requiresPassword: null,

    clients: null,
    clientsPersist: {},
    clientDelete: null,
    clientCreate: null,
    clientCreateName: '',
    clientEditName: null,
    clientEditNameId: null,
    clientEditAddress: null,
    clientEditAddressId: null,
    clientSchedule: null,
    scheduleEdit: null,
    scheduleAllTemplate: { active: true, start: '08:00', end: '17:00' },
    scheduleDays: [
      { key: 'monday', label: 'Monday' },
      { key: 'tuesday', label: 'Tuesday' },
      { key: 'wednesday', label: 'Wednesday' },
      { key: 'thursday', label: 'Thursday' },
      { key: 'friday', label: 'Friday' },
      { key: 'saturday', label: 'Saturday' },
      { key: 'sunday', label: 'Sunday' },
    ],
    timezoneOptions: (() => {
      try {
        if (typeof Intl.supportedValuesOf === 'function') {
          return Intl.supportedValuesOf('timeZone');
        }
      } catch (err) { /* ignore */ }
      return [
        'UTC',
        'Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura',
        'Asia/Singapore', 'Asia/Kuala_Lumpur', 'Asia/Bangkok', 'Asia/Hong_Kong', 'Asia/Tokyo', 'Asia/Seoul', 'Asia/Manila',
        'Asia/Kolkata', 'Asia/Dubai', 'Asia/Shanghai', 'Asia/Taipei',
        'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Amsterdam', 'Europe/Madrid', 'Europe/Moscow',
        'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'America/Sao_Paulo',
        'Australia/Sydney', 'Australia/Perth', 'Pacific/Auckland',
      ];
    })(),
    qrcode: null,

    currentRelease: null,
    latestRelease: null,

    chartOptions: {
      chart: {
        background: 'transparent',
        type: 'bar',
        stacked: false,
        toolbar: {
          show: false,
        },
        animations: {
          enabled: false,
        },
      },
      colors: [
        '#DDDDDD', // rx
        '#EEEEEE', // tx
      ],
      dataLabels: {
        enabled: false,
      },
      plotOptions: {
        bar: {
          horizontal: false,
        },
      },
      xaxis: {
        labels: {
          show: false,
        },
        axisTicks: {
          show: true,
        },
        axisBorder: {
          show: true,
        },
      },
      yaxis: {
        labels: {
          show: false,
        },
        min: 0,
      },
      tooltip: {
        enabled: false,
      },
      legend: {
        show: false,
      },
      grid: {
        show: false,
        padding: {
          left: -10,
          right: 0,
          bottom: -15,
          top: -15,
        },
        column: {
          opacity: 0,
        },
        xaxis: {
          lines: {
            show: false,
          },
        },
      },
    },
  },
  methods: {
    dateTime: value => {
      return new Intl.DateTimeFormat(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
      }).format(value);
    },
    async refresh({
      updateCharts = false,
    } = {}) {
      if (!this.authenticated) return;

      const clients = await this.api.getClients();
      this.clients = clients.map(client => {
        if (client.name.includes('@') && client.name.includes('.')) {
          client.avatar = `https://www.gravatar.com/avatar/${md5(client.name)}?d=blank`;
        }

        if (!this.clientsPersist[client.id]) {
          this.clientsPersist[client.id] = {};
          this.clientsPersist[client.id].transferRxHistory = Array(50).fill(0);
          this.clientsPersist[client.id].transferRxPrevious = client.transferRx;
          this.clientsPersist[client.id].transferTxHistory = Array(50).fill(0);
          this.clientsPersist[client.id].transferTxPrevious = client.transferTx;
        }

        // Debug
        // client.transferRx = this.clientsPersist[client.id].transferRxPrevious + Math.random() * 1000;
        // client.transferTx = this.clientsPersist[client.id].transferTxPrevious + Math.random() * 1000;

        if (updateCharts) {
          this.clientsPersist[client.id].transferRxCurrent = client.transferRx - this.clientsPersist[client.id].transferRxPrevious;
          this.clientsPersist[client.id].transferRxPrevious = client.transferRx;
          this.clientsPersist[client.id].transferTxCurrent = client.transferTx - this.clientsPersist[client.id].transferTxPrevious;
          this.clientsPersist[client.id].transferTxPrevious = client.transferTx;

          this.clientsPersist[client.id].transferRxHistory.push(this.clientsPersist[client.id].transferRxCurrent);
          this.clientsPersist[client.id].transferRxHistory.shift();

          this.clientsPersist[client.id].transferTxHistory.push(this.clientsPersist[client.id].transferTxCurrent);
          this.clientsPersist[client.id].transferTxHistory.shift();
        }

        client.transferTxCurrent = this.clientsPersist[client.id].transferTxCurrent;
        client.transferRxCurrent = this.clientsPersist[client.id].transferRxCurrent;

        client.transferTxHistory = this.clientsPersist[client.id].transferTxHistory;
        client.transferRxHistory = this.clientsPersist[client.id].transferRxHistory;
        client.transferMax = Math.max(...client.transferTxHistory, ...client.transferRxHistory);

        client.hoverTx = this.clientsPersist[client.id].hoverTx;
        client.hoverRx = this.clientsPersist[client.id].hoverRx;

        return client;
      });
    },
    login(e) {
      e.preventDefault();

      if (!this.password) return;
      if (this.authenticating) return;

      this.authenticating = true;
      this.api.createSession({
        password: this.password,
      })
        .then(async () => {
          const session = await this.api.getSession();
          this.authenticated = session.authenticated;
          this.requiresPassword = session.requiresPassword;
          return this.refresh();
        })
        .catch(err => {
          alert(err.message || err.toString());
        })
        .finally(() => {
          this.authenticating = false;
          this.password = null;
        });
    },
    logout(e) {
      e.preventDefault();

      this.api.deleteSession()
        .then(() => {
          this.authenticated = false;
          this.clients = null;
        })
        .catch(err => {
          alert(err.message || err.toString());
        });
    },
    createClient() {
      const name = this.clientCreateName;
      if (!name) return;

      this.api.createClient({ name })
        .catch(err => alert(err.message || err.toString()))
        .finally(() => this.refresh().catch(console.error));
    },
    deleteClient(client) {
      this.api.deleteClient({ clientId: client.id })
        .catch(err => alert(err.message || err.toString()))
        .finally(() => this.refresh().catch(console.error));
    },
    enableClient(client) {
      this.api.enableClient({ clientId: client.id })
        .catch(err => alert(err.message || err.toString()))
        .finally(() => this.refresh().catch(console.error));
    },
    disableClient(client) {
      this.api.disableClient({ clientId: client.id })
        .catch(err => alert(err.message || err.toString()))
        .finally(() => this.refresh().catch(console.error));
    },
    updateClientName(client, name) {
      this.api.updateClientName({ clientId: client.id, name })
        .catch(err => alert(err.message || err.toString()))
        .finally(() => this.refresh().catch(console.error));
    },
    updateClientAddress(client, address) {
      this.api.updateClientAddress({ clientId: client.id, address })
        .catch(err => alert(err.message || err.toString()))
        .finally(() => this.refresh().catch(console.error));
    },
    openSchedule(client) {
      this.clientSchedule = client;
      const days = {};
      const baseDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
      for (const k of baseDays) {
        const d = client.schedule && client.schedule.days && client.schedule.days[k];
        days[k] = {
          active: d ? !!d.active : false,
          start: d && d.start ? d.start : '00:00',
          end: d && d.end ? d.end : '23:59',
        };
      }
      let tz = (client.schedule && client.schedule.timezone) || 'UTC';
      if (this.timezoneOptions.indexOf(tz) === -1) {
        try {
          const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
          if (this.timezoneOptions.indexOf(browserTz) !== -1) tz = browserTz;
        } catch (err) { /* ignore */ }
      }
      this.scheduleEdit = {
        enabled: !!(client.schedule && client.schedule.enabled),
        timezone: tz,
        days,
      };
      this.scheduleAllTemplate = { start: '08:00', end: '17:00' };
    },
    applyAllDaysHours() {
      if (!this.scheduleEdit) return;
      const t = this.scheduleAllTemplate;
      for (const k of Object.keys(this.scheduleEdit.days)) {
        this.scheduleEdit.days[k].start = t.start;
        this.scheduleEdit.days[k].end = t.end;
      }
    },
    saveSchedule() {
      if (!this.clientSchedule || !this.scheduleEdit) return;
      const clientId = this.clientSchedule.id;
      const schedule = JSON.parse(JSON.stringify(this.scheduleEdit));
      this.api.updateClientSchedule({ clientId, schedule })
        .then(() => {
          this.clientSchedule = null;
          this.scheduleEdit = null;
        })
        .catch(err => alert(err.message || err.toString()))
        .finally(() => this.refresh().catch(console.error));
    },
  },
  computed: {
    allDaysActive: {
      get() {
        if (!this.scheduleEdit || !this.scheduleEdit.days) return false;
        const days = Object.values(this.scheduleEdit.days);
        if (days.length === 0) return false;
        return days.every(d => d && d.active);
      },
      set(value) {
        if (!this.scheduleEdit || !this.scheduleEdit.days) return;
        for (const k of Object.keys(this.scheduleEdit.days)) {
          this.scheduleEdit.days[k].active = !!value;
        }
      },
    },
  },
  filters: {
    bytes,
    timeago: value => {
      return timeago().format(value);
    },
  },
  mounted() {
    this.api = new API();
    this.api.getSession()
      .then(session => {
        this.authenticated = session.authenticated;
        this.requiresPassword = session.requiresPassword;
        this.refresh({
          updateCharts: true,
        }).catch(err => {
          alert(err.message || err.toString());
        });
      })
      .catch(err => {
        alert(err.message || err.toString());
      });

    setInterval(() => {
      this.refresh({
        updateCharts: true,
      }).catch(console.error);
    }, 1000);

    Promise.resolve().then(async () => {
      const currentRelease = await this.api.getRelease();
      const latestRelease = await fetch('https://wg-easy.github.io/wg-easy/changelog.json')
        .then(res => res.json())
        .then(releases => {
          const releasesArray = Object.entries(releases).map(([version, changelog]) => ({
            version: parseInt(version, 10),
            changelog,
          }));
          releasesArray.sort((a, b) => {
            return b.version - a.version;
          });

          return releasesArray[0];
        });

      console.log(`Current Release: ${currentRelease}`);
      console.log(`Latest Release: ${latestRelease.version}`);

      if (currentRelease >= latestRelease.version) return;

      this.currentRelease = currentRelease;
      this.latestRelease = latestRelease;
    }).catch(console.error);
  },
});
