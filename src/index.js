import { InstanceBase, runEntrypoint, InstanceStatus, Regex } from '@companion-module/base'
import UpdateActions from './actions.js'
import UpdateFeedbacks from './feedbacks.js'
import UpgradeScripts from './upgrades.js'
import UpdateVariableDefinitions from './variables.js'
import PQueue from 'p-queue'

const RECONNECT_TIMEOUT = 10 // Number of seconds to try reconnect
const queue = new PQueue({ concurrency: 1, interval: 10, intervalCap: 1 })

class SmaartV3 extends InstanceBase {
	constructor(internal) {
		super(internal)
		this.reconnecting = null
		this.closing = false
	}

	/**
	 * Main initialization when it's ok to login
	 * @param {Object} config New configuration
	 * @access public
	 * @since 1.0.0
	 */

	async init(config) {
		this.configUpdated(config)
		this.updateActions() // export actions
		this.updateFeedbacks() // export feedbacks
		this.updateVariableDefinitions() // export variable definitions
	}

	/**
	 * Ends session if connected
	 * @since 1.0.0
	 */
	async destroy() {
		this.log('debug', `destroy ${this.id}:${this.label}`)
		queue.clear()
		this.logout()
	}

	/**
	 * Process configuration updates
	 * @param {Object} config New configuration
	 * @access public
	 * @since 1.0.0
	 */

	async configUpdated(config) {
		this.config = config
		queue.clear()
		this.updateStatus(InstanceStatus.Connecting)

		this.logout()
		if (config.host && config.port) {
			await this.login(config.host, config.port)
		}
	}

	/**
	 * Configuration fields that can be used
	 * @returns {Array}
	 * @access public
	 * @since 1.0.0
	 */

	getConfigFields() {
		return [
			{
				type: 'static-text',
				id: 'info',
				width: 12,
				label: 'Information',
				value:
					'This will connect with Rational Acoustics Smaart server.<br> If using Smaart V9 or newer this module will not work!',
			},
			{
				type: 'textinput',
				id: 'host',
				label: 'Target IP/ Hostname',
				width: 12,
				regex: Regex.HOSTNAME | Regex.IP,
			},
			{
				type: 'textinput',
				id: 'port',
				label: 'Target Port',
				width: 12,
				regex: Regex.PORT,
			},
			{
				type: 'static-text',
				id: 'info',
				width: 12,
				label: 'Information',
				value: 'If authentication is not used leave password blank.',
			},
			{
				type: 'textinput',
				id: 'password',
				label: 'Password',
				width: 6,
			},
		]
	}

	/**
	 * Login to the device
	 * @param {string} host Host to connect to
	 * @param {string} port Port to connect on
	 * @access public
	 * @since 1.0.0
	 */
	async login(host, port) {
		this.logout()

		this.closing = false

		if (this.reconnecting) {
			clearTimeout(this.reconnecting)
			this.reconnecting = null
		}

		// Connect to remote control websocket of Smaart
		this.socket = new WebSocket('ws://' + host + ':' + parseInt(port) + '/api/v3/')
		this.updateStatus(InstanceStatus.Connecting)
		this.socket.addEventListener('open', () => {
			this.updateStatus(InstanceStatus.Ok)
			this.log('info', `Connected to ws://${host}:${port}/`)
			this.sendData({
				sequenceNumber: 1,
				action: 'get',
			})
		})

		this.socket.addEventListener('error', (err) => {
			this.log('error', JSON.stringify(err))
			this.updateStatus(InstanceStatus.ConnectionFailure, err.message)
		})

		this.socket.addEventListener('close', (event) => {
			this.updateStatus(InstanceStatus.ConnectionFailure, 'Disconnected from Smaart')
			this.log('warn', `Socket Closed ${event.code} ${event.reason}`)
			if (!this.closing) {
				this.keep_login_retry(RECONNECT_TIMEOUT)
			}
		})

		this.socket.addEventListener('message', (message) => {
			const jsonMsg = JSON.parse(message)
			this.log('debug', `Message Recieved: ${message}`)
			this.log('debug', `Parsed Message: ${JSON.stringify(jsonMsg)}`)
			try {
				if (jsonMsg?.response?.error != undefined) {
					if (jsonMsg['response']['error'] === 'incorect password') {
						this.updateStatus(InstanceStatus.AuthenticationFailure)
						this.log('error', 'Password is incorrect.')
						// this.keep_login_retry(10) Why retry if the password is incorrect?
					}
				} else {
					this.updateStatus(InstanceStatus.Ok)

					if (jsonMsg?.sequenceNumber === 1 && jsonMsg?.response?.authenticationRequired) {
						this.log('info', 'Authenticating')
						this.sendData({
							action: 'set',
							properties: [
								{
									password: this.config.password,
								},
							],
						})
					}
				}
			} catch (e) {
				this.updateStatus(InstanceStatus.UnknownWarning)
				this.log('warn', `Parsing Error. ${JSON.stringify(e)}`)
			}
		})
	}

	/**
	 * Try login again after timeout
	 * @param {number} timeout Timeout to try reconnection
	 * @access public
	 * @since 1.0.0
	 */
	keep_login_retry(timeout) {
		if (this.reconnecting) {
			return
		}

		this.log('info', 'Attempting to reconnect in ' + timeout + ' seconds.')
		this.reconnecting = setTimeout(this.login(this.config.host, this.config.port), timeout * 1000)
	}

	/**
	 * Logout of smaart
	 * @access public
	 * @since 1.0.0
	 */
	logout() {
		this.closing = true
		if (this.reconnecting) {
			clearTimeout(this.reconnecting)
			this.reconnecting = null
		}

		if (this.socket !== undefined) {
			// Disconnect if already connected
			if (this.socket?.readyState === WebSocket.OPEN || this.socket?.readyState === WebSocket.CONNECTING) {
				this.socket.close(1000)
			}
			delete this.socket
		}
	}

	/**
	 * Send data on websocket connection
	 * @param {object} jsonPayload object to send as json serialised data
	 * @access public
	 * @since 1.0.0
	 */

	async sendData(jsonPayload) {
		await queue.add(() => {
			if (this.socket != undefined && this.socket.readyState === WebSocket.OPEN) {
				this.socket.send(JSON.stringify(jsonPayload))
			} else {
				this.log('error', 'Not connected!')
			}
		})
	}

	/**
	 * Sends command to reset averages
	 * @access public
	 * @since 1.0.0
	 */
	resetAvg() {
		const payload = {
			sequenceNumber: 10,
			action: 'set',
			target: 'activeMeasurements',
			properties: [
				{
					runningAverage: 0,
				},
			],
		}

		this.sendData(payload)
	}

	/**
	 * Sends command to change tabs
	 * @param {string} tabName
	 * @access public
	 * @since 1.0.0
	 */
	selectTab(tabName) {
		const payload = {
			sequenceNumber: 11,
			action: 'set',
			target: 'tabs',
			properties: [
				{
					activeTab: tabName,
				},
			],
		}

		this.sendData(payload)
	}

	/**
	 * Sends command to start all measurments on a tab
	 * @param {string} tabName
	 * @access public
	 * @since 1.0.0
	 */
	startAllMeasurements(tabName) {
		const payload = {
			sequenceNumber: 12,
			action: 'set',
			target: {
				tabName: tabName,
				measurementName: 'allMeasurements',
			},
			properties: [{ active: true }],
		}

		this.sendData(payload)
	}

	/**
	 * Sends command to turn the generator on or off
	 * @param {boolean} state
	 * @access public
	 * @since 1.0.0
	 */
	generatorState(state) {
		const payload = {
			sequenceNumber: 13,
			action: 'set',
			target: 'signalGenerator',
			properties: [{ active: state }],
		}

		this.sendData(payload)
	}

	/**
	 * Sends command to set the generator level
	 * @param {number} level
	 * @access public
	 * @since 1.0.0
	 */
	setGeneratorLevel(level) {
		const payload = {
			sequenceNumber: 14,
			action: 'set',
			target: 'signalGenerator',
			properties: [{ gain: level }],
		}

		this.sendData(payload)
	}

	/**
	 * Sends command to turn tracking for an entire tab on or off
	 * @param {boolean} state
	 * @access public
	 * @since 1.0.0
	 */
	trackingState(state) {
		const payload = {
			sequenceNumber: 15,
			action: 'set',
			target: {
				measurementName: 'allTransferFunctionMeasurements',
			},
			properties: [{ trackingDelay: state }],
		}
		this.sendData(payload)
	}

	/**
	 * Sends command to capture current trace
	 * @param {string} traceName
	 * @access public
	 * @since 2.0.0
	 */

	/* captureTrace(traceName) {
		const payload = {
			sequenceNumber: 42,
			action: 'capture',
			target: {
				measurementName: traceName,
			},
		}
		this.log('debug', `captureTrace: ${JSON.stringify(payload)}`)
		this.sendData(payload)
	} */

	/**
	 * Sends command to capture current trace
	 * @param {string} traceName
	 * @param {string} tracePath
	 * @access public
	 * @since 2.0.0
	 */

	/* renameTrace(traceName, tracePath) {
		const payload = {
			sequenceNumber: 42,
			action: 'set',
			target: {
				traceFilePath: tracePath,
			},
			properties: [{ name: traceName }],
		}
		this.log('debug', `renameTrace: ${JSON.stringify(payload)}`)
		this.sendData(payload)
	} */

	/**
	 * Sends command to issueCommand handler
	 * @param {string} command
	 * @access public
	 * @since 1.0.0
	 */
	issueCommand(command) {
		const payload = {
			sequenceNumber: 16,
			action: 'issueCommand',
			properties: [{ keypress: command }],
		}
		this.log('debug', `issueCommand: ${JSON.stringify(payload)}`)
		this.sendData(payload)
	}

	updateActions() {
		UpdateActions(this)
	}

	updateFeedbacks() {
		UpdateFeedbacks(this)
	}

	updateVariableDefinitions() {
		UpdateVariableDefinitions(this)
	}
}

runEntrypoint(SmaartV3, UpgradeScripts)
