import UserController from 'controller/user-controller.js'
import Pusher from 'model/pusher.js'
import { EVENT, DEFAULT_COMPONENT_CONFIG } from 'common/constants.js'
import Event from 'utils/event.js'
import * as ENV from 'utils/environment.js'
import { ajax2 } from '../../../../utils/util';

const TAG_NAME = 'TRTC-ROOM'

Component({
  /**
   * 组件的属性列表
   */
  properties: {
    // 必要的初始化参数
    config: {
      type: Object,
      value: {
        sdkAppID: '',
        userID: '',
        userSig: '',
        template: '',
        debugMode: false, // 是否开启调试模式
      },
      observer: function(newVal, oldVal) {
        this._propertyObserver({
          'name': 'config', newVal, oldVal,
        })
      }
    },
  },

  /**
   * 组件的初始数据
   */
  data: {
    pusher: null,
    debugPanel: false, // 是否打开组件调试面板
    debug: false, // 是否打开player pusher 的调试信息
    streamList: [], // 用于渲染player列表,存储stram
    visibleStreamList: [], // 有音频或者视频的StreamList
    userList: [], // 扁平化的数据用来返回给用户
    template: '', // 不能设置默认值，当默认值和传入组件的值不一致时，iOS渲染失败
    cameraPosition: '', // 摄像头位置，用于debug
    panelName: '', // 控制面板名称，包括 setting-panel  memberlist-panel
    localVolume: 0,
    remoteVolumeList: [],
    appVersion: ENV.APP_VERSION,
    libVersion: ENV.LIB_VERSION,
    isFullscreenDevice: ENV.IS_FULLSCREEN_DEVICE,
    MICVolume: 50,
    BGMVolume: 50,
    BGMProgress: 0,

    beautyStyle: 'smooth',
    beautyStyleArray: [
      { value: 'smooth', label: '光滑', checked: true },
      { value: 'nature', label: '自然', checked: false },
      { value: 'close', label: '关闭', checked: false },
    ],
    filterIndex: 0,
    filterArray: [
      { value: 'standard', label: '标准' },
      { value: 'pink', label: '粉嫩' },
      { value: 'nostalgia', label: '怀旧' },
      { value: 'blues', label: '蓝调' },
      { value: 'romantic', label: '浪漫' },
      { value: 'cool', label: '清凉' },
      { value: 'fresher', label: '清新' },
      { value: 'solor', label: '日系' },
      { value: 'aestheticism', label: '唯美' },
      { value: 'whitening', label: '美白' },
      { value: 'cerisered', label: '樱红' },
    ],
    audioReverbType: 0,
    audioReverbTypeArray: ['关闭', 'KTV', '小房间', '大会堂', '低沉', '洪亮', '金属声', '磁性'],
    canIHangUp: true, // 接通后10s内不能挂断视频
    isConnectioned: false, // 是否接通(根据远端用户是否进入过房间来判断)
    isRemotIn: false, // 远端用户是否在房间 这个和 isConnectioned 组合可以判断是否为远端用户主动挂断
    isClickBtnToHangeUp: false, // 是否为点击按钮挂断 为了区分按钮点击挂断和[ios 右滑 & 安卓手势 & 安卓物理返回]挂断, 处理方式不同
    timer: 0, // 从 0s 开始计时 
    formatTimer: '00:00:00',
    timerInstance: null
  },
  /**
   * 生命周期方法
   */
  lifetimes: {
    created: function() {
      // 在组件实例刚刚被创建时执行
      console.log(TAG_NAME, 'created', ENV)
    },
    attached: function() {
      // 在组件实例进入页面节点树时执行
      console.log(TAG_NAME, 'attached')
      this._init()
    },
    ready: function() {
      // 在组件在视图层布局完成后执行
      console.log(TAG_NAME, 'ready')
    },
    detached: function() {
      // 在组件实例被从页面节点树移除时执行
      console.log(TAG_NAME, 'detached')
      this.data.timerInstance && clearInterval(this.data.timerInstance);

      // 如果医生还未接诊 也就是连接还未建立 此时离开房间会调取消问诊接口
      console.log('detached', this.data.isConnectioned, this.data.isRemotIn);
      if (!this.data.isConnectioned) {
        this.cancleInquery(); // 取消问诊接口
        wx.showToast({
          title: '问诊已放弃',
          icon: 'none'
        })
        return false;
      } else if (this.data.isRemotIn && !this.data.isClickBtnToHangeUp) {
        // 如果视频接通了 而且远端用户在房间 说明不是远端挂断 然后又是非挂断按钮点击的挂断 此时调用该跳转方法 
        // 此跳转方法会在返回信息填写页再调用
        // to 问诊详情
        const { inquiryReportGuid } =  wx.getStorageSync('inqueryInfo') || {};

        this.exitRoom();
        wx.navigateTo({
          url: '/pages/inquiry/prescriptionDetails/prescriptionDetails?inquiryType=video&inquiryId=' + inquiryReportGuid,
        })
      }
    },
    error: function(error) {
      // 每当组件方法抛出错误时执行
      console.log(TAG_NAME, 'error', error)
    },
  },
  pageLifetimes: {
    show: function() {
      // 组件所在的页面被展示时执行
      console.log(TAG_NAME, 'show status:', this.status)
      if (this.status.isPending) {
        // 经历了 5000 挂起事件
        this.status.isPending = false
        // 修复iOS 最小化触发5000事件后，音频推流失败的问题
        // if (ENV.IS_IOS && this.data.pusher.enableMic) {
        //   this.unpublishLocalAudio().then(()=>{
        //     this.publishLocalAudio()
        //   })
        // }
        // 经历了 5001 浮窗关闭事件，小程序底层会自动退房，恢复小程序时组件需要重新进房
        // 重新进房
        this.enterRoom({ roomID: this.data.config.roomID }).then(()=>{
          // 进房后开始推送视频或音频
          // setTimeout(()=>{
          //   this.publishLocalVideo()
          //   this.publishLocalAudio()
          // }, 2000)
        })
      } else if (ENV.IS_ANDROID && this.status.pageLife === 'hide' && this.status.isOnHideAddStream && this.data.streamList.length > 0) {
        // 微信没有提供明确的最小化事件，onHide事件，不一定是最小化
        // 获取所有的player 清空 src 重新赋值 验证无效
        // 清空 visibleStreamList 重新赋值， 验证无效
        // 退房重新进房，有效但是成本比较高

        // 将标记了 isOnHideAdd 的 stream 的 palyer 销毁并重新渲染
        const streamList = this.data.streamList
        let tempStreamList = []
        // 过滤 onHide 时新增的 stream
        for (let i = 0; i < streamList.length; i++) {
          if (streamList[i].isOnHideAdd && streamList[i].playerContext) {
            const stream = streamList[i]
            tempStreamList.push(stream)
            stream.playerContext = undefined
            streamList.splice(i, 1)
          }
        }
        // 设置渲染，销毁onHide 时新增的 player
        this._setList({
          streamList: streamList,
        }).then(() => {
          for (let i = 0; i < tempStreamList.length; i++) {
            streamList.push(tempStreamList[i])
          }
          // 设置渲染，重新创建 onHide 时新增的 player
          // setTimeout(()=>{
          this._setList({
            streamList: streamList,
          }).then(() => {
            for (let i = 0; i < tempStreamList.length; i++) {
              tempStreamList[i] = wx.createLivePlayerContext(tempStreamList[i].streamID, this)
            }
            tempStreamList = []
          })
          // }, 500)
        })
        this.status.isOnHideAddStream = false
      }
      this.status.pageLife = 'show'
    },
    hide: function() {
      // 组件所在的页面被隐藏时执行
      console.log(TAG_NAME, 'hide')
      this.status.pageLife = 'hide'
    },
    resize: function(size) {
      // 组件所在的页面尺寸变化时执行
      console.log(TAG_NAME, 'resize', size)
    },
  },
  /**
   * 组件的方法列表
   */
  methods: {
    /**
     * 初始化各项参数和用户控制模块，在组件实例触发 attached 时调用，此时不建议对View进行变更渲染（调用setData方法）
     */
    _init() {
      console.log(TAG_NAME, '_init')
      this.userController = new UserController(this)
      this._emitter = new Event()
      this.EVENT = EVENT
      this._initStatus()
      this._bindEvent()
      this._keepScreenOn()
      console.log(TAG_NAME, '_init success component:', this)
    },
    _initStatus() {
      this.status = {
        isPush: false, // 推流状态
        isPending: false, // 挂起状态，触发5000事件标记为true，onShow后标记为false
        pageLife: '', // 页面生命周期 hide, show
        isOnHideAddStream: false, // onHide后有新增Stream
      }
      this._lastTapTime = 0 // 点击时间戳 用于判断双击事件
      this._beforeLastTapTime = 0 // 点击时间戳 用于判断双击事件
      this._lastTapCoordinate = { x: 0, y: 0 }, // 点击时的坐标
      this._isFullscreen = false // 是否进入全屏状态
    },
    /**
     * 监听组件属性变更，外部变更组件属性时触发该监听
     * @param {Object} data newVal，oldVal
     */
    _propertyObserver(data) {
      console.log(TAG_NAME, '_propertyObserver', data, this.data.config)
      if (data.name === 'config') {
        const config = Object.assign({}, DEFAULT_COMPONENT_CONFIG, data.newVal)
        console.log(TAG_NAME, '_propertyObserver config:', config)
        // 由于 querystring 只支持 String 类型，做一个类型防御
        if (typeof config.debugMode === 'string') {
          config.debugMode = config.debugMode === 'true' ? true : false
        }
        
        // 独立设置与pusher无关的配置
        this.setData({
          template: config.template,
          debugMode: config.debugMode || false,
          debug: config.debugMode || false,
        })
        this._setPusherConfig(config)
      }
    },

    //  _______             __        __  __
    //  |       \           |  \      |  \|  \
    //  | $$$$$$$\ __    __ | $$____  | $$ \$$  _______
    //  | $$__/ $$|  \  |  \| $$    \ | $$|  \ /       \
    //  | $$    $$| $$  | $$| $$$$$$$\| $$| $$|  $$$$$$$
    //  | $$$$$$$ | $$  | $$| $$  | $$| $$| $$| $$
    //  | $$      | $$__/ $$| $$__/ $$| $$| $$| $$_____
    //  | $$       \$$    $$| $$    $$| $$| $$ \$$     \
    //   \$$        \$$$$$$  \$$$$$$$  \$$ \$$  \$$$$$$$

    /**
     * 进房
     * @param {Object} params 必传 roomID 取值范围 1 ~ 4294967295
     * @returns {Promise}
     */
    enterRoom(params) {
      return new Promise((resolve, reject) => {
        console.log(TAG_NAME, 'enterRoom')
        console.log(TAG_NAME, 'params', params)
        console.log(TAG_NAME, 'config', this.data.config)
        console.log(TAG_NAME, 'pusher', this.data.pusher)
        // 1. 补齐进房参数，校验必要参数是否齐全
        if (params) {
          Object.assign(this.data.pusher, params)
          Object.assign(this.data.config, params)
        }
        if (!this._checkParam(this.data.config)) {
          reject(new Error('缺少必要参数'))
          return
        }
        // 2. 根据参数拼接 push url，赋值给 live-pusher，
        this._getPushUrl(this.data.config).then((pushUrl)=> {
          console.log('pushUrlpushUrl',pushUrl)
          this.data.pusher.url = pushUrl
          this.setData({
            pusher: this.data.pusher,
          }, () => {
            // 真正进房成功需要通过 1018 事件通知
            console.log(TAG_NAME, 'enterRoom', this.data.pusher)
            // view 渲染成功回调后，开始推流
            this.data.pusher.getPusherContext().start()
            this.status.isPush = true
            resolve()
          })
        }).catch((res)=> {
          // 进房失败需要通过 pusher state 事件通知，目前还没有准确的事件通知
          console.error(TAG_NAME, 'enterRoom error', res)
          reject(res)
        })
      })
    },
    /**
     * 退房，停止推流和拉流，并重置数据
     * @returns {Promise}
     */
    exitRoom() {
      if (this.status.pageLife === 'hide') {
        // 如果是退后台触发 onHide，不能调用 pusher API
        console.warn(TAG_NAME, '小程序最小化时不能调用 exitRoom，如果不想听到远端声音，可以调用取消订阅，如果不想远端听到声音，可以调用取消发布')
      }
      return new Promise((resolve, reject) => {
        console.log(TAG_NAME, 'exitRoom')
        this.data.pusher.reset()
        this.status.isPush = false
        const result = this.userController.reset()
        this.setData({
          pusher: this.data.pusher,
          userList: result.userList,
          streamList: result.streamList
        }, () => {
          // 在销毁页面时调用exitRoom时，不会走到这里
          resolve({ userList: this.data.userList, streamList: this.data.streamList })
          console.log(TAG_NAME, 'exitRoom success', this.data.pusher, this.data.streamList, this.data.userList)
          // 20200421 iOS 仍然没有1019事件通知退房，退房事件移动到 exitRoom 方法里，但不是后端通知的退房成功
          this._emitter.emit(EVENT.LOCAL_LEAVE, { userID: this.data.pusher.userID })
        })
      })
    },
    /**
     * 开启摄像头
     * @returns {Promise}
     */
    publishLocalVideo() {
      // 设置 pusher enableCamera
      console.log(TAG_NAME, 'publishLocalVideo 开启摄像头')
      return this._setPusherConfig({ enableCamera: true })
    },
    /**
     * 关闭摄像头
     * @returns {Promise}
     */
    unpublishLocalVideo() {
      // 设置 pusher enableCamera
      console.log(TAG_NAME, 'unpublshLocalVideo 关闭摄像头')
      return this._setPusherConfig({ enableCamera: false })
    },
    /**
     * 开启麦克风
     * @returns {Promise}
     */
    publishLocalAudio() {
      // 设置 pusher enableCamera
      console.log(TAG_NAME, 'publishLocalAudio 开启麦克风')
      return this._setPusherConfig({ enableMic: true })
    },
    /**
     * 关闭麦克风
     * @returns {Promise}
     */
    unpublishLocalAudio() {
      // 设置 pusher enableCamera
      console.log(TAG_NAME, 'unpublshLocalAudio 关闭麦克风')
      return this._setPusherConfig({ enableMic: false })
    },
    /**
     * 订阅远端视频 主流 小画面 辅流
     * @param {Object} params {userID,streamType} streamType 传入 small 时修改对应的主流 url 的 _definitionType 参数为 small, stream.streamType 仍为 main
     * @returns {Promise}
     */
    subscribeRemoteVideo(params) {
      console.log(TAG_NAME, 'subscribeRemoteVideo', params)
      // 设置指定 user streamType 的 muteVideo 为 false
      const config = {
        muteVideo: false,
      }
      // 本地数据结构里的 streamType 只支持 main 和 aux ，订阅 small 也是对 main 进行处理
      const streamType = params.streamType === 'small' ? 'main' : params.streamType
      const stream = this.userController.getStream({
        userID: params.userID,
        streamType: streamType,
      })
      stream.muteVideoPrev = false // 用于分页切换时保留player当前的订阅状态

      if (params.streamType === 'small' || params.streamType === 'main') {
        if (stream && stream.streamType === 'main') {
          console.log(TAG_NAME, 'subscribeRemoteVideo switch small', stream.src)
          if (params.streamType === 'small') {
            config.src = stream.src.replace('main', 'small')
            config._definitionType = 'small' // 用于设置面板的渲染
          } else if (params.streamType === 'main') {
            stream.src = stream.src.replace('small', 'main')
            config._definitionType = 'main'
          }
          console.log(TAG_NAME, 'subscribeRemoteVideo', stream.src)
        }
      }
      return this._setPlayerConfig({
        userID: params.userID,
        streamType: streamType,
        config: config,
      })
    },
    /**
     * 取消订阅远端视频
     * @param {Object} params {userID,streamType}
     * @returns {Promise}
     */
    unsubscribeRemoteVideo(params) {
      console.log(TAG_NAME, 'unsubscribeRemoteVideo', params)
      const stream = this.userController.getStream({
        userID: params.userID,
        streamType: params.streamType,
      })
      stream.muteVideoPrev = true // 用于分页切换时保留player当前的订阅状态
      // 设置指定 user streamType 的 muteVideo 为 true
      return this._setPlayerConfig({
        userID: params.userID,
        streamType: params.streamType,
        config: {
          muteVideo: true,
        },
      })
    },
    /**
     * 订阅远端音频
     * @param {Object} params userID 用户ID
     * @returns {Promise}
     */
    subscribeRemoteAudio(params) {
      console.log(TAG_NAME, 'subscribeRemoteAudio', params)
      return this._setPlayerConfig({
        userID: params.userID,
        streamType: 'main',
        config: {
          muteAudio: false,
        },
      })
    },
    /**
     * 取消订阅远端音频
     * @param {Object} params userID 用户ID
     * @returns {Promise}
     */
    unsubscribeRemoteAudio(params) {
      console.log(TAG_NAME, 'unsubscribeRemoteAudio', params)
      return this._setPlayerConfig({
        userID: params.userID,
        streamType: 'main',
        config: {
          muteAudio: true,
        },
      })
    },
    on(eventCode, handler, context) {
      this._emitter.on(eventCode, handler, context)
    },
    off(eventCode, handler) {
      this._emitter.off(eventCode, handler)
    },
    getRemoteUserList() {
      return this.data.userList
    },
    /**
     * 切换前后摄像头
     */
    switchCamera() {
      if (!this.data.cameraPosition) {
        // this.data.pusher.cameraPosition 是初始值，不支持动态设置
        this.data.cameraPosition = this.data.pusher.frontCamera
      }
      console.log(TAG_NAME, 'switchCamera', this.data.cameraPosition)
      this.data.cameraPosition = this.data.cameraPosition === 'front' ? 'back' : 'front'
      this.setData({
        cameraPosition: this.data.cameraPosition,
      }, () => {
        console.log(TAG_NAME, 'switchCamera success', this.data.cameraPosition)
      })
      // wx 7.0.9 不支持动态设置 pusher.frontCamera ，只支持调用 API switchCamer() 设置，这里修改 cameraPosition 是为了记录状态
      this.data.pusher.getPusherContext().switchCamera()
    },
    /**
     * 设置指定player view的渲染坐标和尺寸
     * @param {object} params
     * userID: string
     * streamType: string
     * xAxis: number
     * yAxis: number
     * width: number
     * height: number
     * @returns {Promise}
     */
    setViewRect(params) {
      console.log(TAG_NAME, 'setViewRect', params)
      if (this.data.template !== 'custom') {
        console.warn(`如需使用setViewRect方法，请初始化时设置template:"custom", 当前 template:"${this.data.template}"`)
      }
      console.info(`不建议使用该方法动态修改样式，避免引起微信小程序渲染问题，建议直接修改 wxml wxss 进行样式定制化`)
      if (this.data.pusher.userID === params.userID) {
        return this._setPusherConfig({
          xAxis: params.xAxis,
          yAxis: params.yAxis,
          width: params.width,
          height: params.height,
        })
      }
      return this._setPlayerConfig({
        userID: params.userID,
        streamType: params.streamType,
        config: {
          xAxis: params.xAxis,
          yAxis: params.yAxis,
          width: params.width,
          height: params.height,
        },
      })
    },
    /**
     * 设置指定 player 或者 pusher view 是否可见
     * @param {object} params
     * userID: string
     * streamType: string
     * isVisible：boolean
     * @returns {Promise}
     */
    setViewVisible(params) {
      // console.log(this);
      console.log(TAG_NAME, 'setViewVisible', params)
      if (this.data.template !== 'custom') {
        console.warn(`如需使用setViewVisible方法，请初始化时设置template:"custom", 当前 template:"${this.data.template}"`)
      }
      console.info(`不建议使用该方法动态修改样式，避免引起微信小程序渲染问题，建议直接修改 wxml wxss 进行样式定制化`)
      if (this.data.pusher.userID === params.userID) {
        return this._setPusherConfig({
          isVisible: params.isVisible,
        })
      }
      return this._setPlayerConfig({
        userID: params.userID,
        streamType: params.streamType,
        config: {
          isVisible: params.isVisible,
        },
      })
    },
    /**
     * 设置指定player view的层级
     * @param {Object} params
     * userID: string
     * streamType: string
     * zIndex: number
     * @returns {Promise}
     */
    setViewZIndex(params) {
      console.log(TAG_NAME, 'setViewZIndex', params)
      if (this.data.template !== 'custom') {
        console.warn(`如需使用setViewZIndex方法，请初始化时设置template:"custom", 当前 template:"${this.data.template}"`)
      }
      console.info(`不建议使用该方法动态修改样式，避免引起微信小程序渲染问题，建议直接修改 wxml wxss 进行样式定制化`)
      if (this.data.pusher.userID === params.userID) {
        return this._setPusherConfig({
          zIndex: params.zindex || params.zIndex,
        })
      }
      return this._setPlayerConfig({
        userID: params.userID,
        streamType: params.streamType,
        config: {
          zIndex: params.zindex || params.zIndex,
        },
      })
    },
    /**
     * 播放背景音
     * @param {Object} params url
     * @returns {Promise}
     */
    playBGM(params) {
      return new Promise((resolve, reject) => {
        this.data.pusher.getPusherContext().playBGM({
          url: params.url,
          // 已经有相关事件不需要在这里监听,目前用于测试
          success: () => {
            console.log(TAG_NAME, '播放背景音成功')
            // this._emitter.emit(EVENT.BGM_PLAY_START)
            resolve()
          },
          fail: () => {
            console.log(TAG_NAME, '播放背景音失败')
            this._emitter.emit(EVENT.BGM_PLAY_FAIL)
            reject(new Error('播放背景音失败'))
          },
          // complete: () => {
          //   console.log(TAG_NAME, '背景完成')
          //   this._emitter.emit(EVENT.BGM_PLAY_COMPLETE)
          // },
        })
      })
    },
    stopBGM() {
      this.data.pusher.getPusherContext().stopBGM()
    },
    pauseBGM() {
      this.data.pusher.getPusherContext().pauseBGM()
    },
    resumeBGM() {
      this.data.pusher.getPusherContext().resumeBGM()
    },
    /**
     * 设置背景音音量
     * @param {Object} params volume
     */
    setBGMVolume(params) {
      console.log(TAG_NAME, 'setBGMVolume', params)
      this.data.pusher.getPusherContext().setBGMVolume({ volume: params.volume })
    },
    /**
     * 设置麦克风音量
     * @param {Object} params volume
     */
    setMICVolume(params) {
      console.log(TAG_NAME, 'setMICVolume', params)
      this.data.pusher.getPusherContext().setMICVolume({ volume: params.volume })
    },
    /**
     * pusher 和 player 的截图并保存
     * @param {Object} params userID streamType
     * @returns {Promise}
     */
    snapshot(params) {
      console.log(TAG_NAME, 'snapshot', params)
      return new Promise((resolve, reject) => {
        this.captureSnapshot(params).then((result)=>{
          wx.saveImageToPhotosAlbum({
            filePath: result.tempImagePath,
            success(res) {
              wx.showToast({
                title: '已保存到相册',
              })
              console.log('save photo is success', res)
              resolve(result)
            },
            fail: function(error) {
              wx.showToast({
                icon: 'none',
                title: '保存失败',
              })
              console.log('save photo is fail', error)
              reject(error)
            },
          })
        }).catch((error)=>{
          reject(error)
        })
      })
    },
    /**
     * 获取pusher 和 player 的截图
     * @param {Object} params userID streamType
     * @returns {Promise}
     */
    captureSnapshot(params) {
      return new Promise((resolve, reject) => {
        if (params.userID === this.data.pusher.userID) {
        // pusher
          this.data.pusher.getPusherContext().snapshot({
            quality: 'raw',
            complete: (result) => {
              console.log(TAG_NAME, 'snapshot pusher', result)
              if (result.tempImagePath) {
                resolve(result)
              } else {
                console.log('snapShot 回调失败', result)
                reject(new Error('截图失败'))
              }
            },
          })
        } else {
        // player
          this.userController.getStream(params).playerContext.snapshot({
            quality: 'raw',
            complete: (result) => {
              console.log(TAG_NAME, 'snapshot player', result)
              if (result.tempImagePath) {
                resolve(result)
              } else {
                console.log('snapShot 回调失败', result)
                reject(new Error('截图失败'))
              }
            },
          })
        }
      })
    },
    // ______             __                                              __
    // |      \           |  \                                            |  \
    //  \$$$$$$ _______  _| $$_     ______    ______   _______    ______  | $$
    //   | $$  |       \|   $$ \   /      \  /      \ |       \  |      \ | $$
    //   | $$  | $$$$$$$\\$$$$$$  |  $$$$$$\|  $$$$$$\| $$$$$$$\  \$$$$$$\| $$
    //   | $$  | $$  | $$ | $$ __ | $$    $$| $$   \$$| $$  | $$ /      $$| $$
    //  _| $$_ | $$  | $$ | $$|  \| $$$$$$$$| $$      | $$  | $$|  $$$$$$$| $$
    // |   $$ \| $$  | $$  \$$  $$ \$$     \| $$      | $$  | $$ \$$    $$| $$
    //  \$$$$$$ \$$   \$$   \$$$$   \$$$$$$$ \$$       \$$   \$$  \$$$$$$$ \$$
    /**
     * 设置推流参数并触发页面渲染更新
     * @param {Object} config live-pusher 的配置
     * @returns {Promise}
     */
    _setPusherConfig(config, skipLog = false) {
      if (!skipLog) {
        console.log(TAG_NAME, '_setPusherConfig', config, this.data.pusher)
      }
      return new Promise((resolve, reject) => {
        if (!this.data.pusher) {
          this.data.pusher = new Pusher(config)
        } else {
          Object.assign(this.data.pusher, config)
        }
        this.setData({
          pusher: this.data.pusher,
        }, () => {
          if (!skipLog) {
            console.log(TAG_NAME, '_setPusherConfig setData compelete', 'config:', config, 'pusher:', this.data.pusher)
          }
          resolve(config)
        })
      })
    },
    /**
     * 设置指定 player 属性并触发页面渲染
     * @param {Object} params include userID,streamType,config
     * @returns {Promise}
     */
    _setPlayerConfig(params) {
      const userID = params.userID
      const streamType = params.streamType
      const config = params.config
      console.log(TAG_NAME, '_setPlayerConfig', params)
      return new Promise((resolve, reject) => {
        // 获取指定的userID streamType 的 stream
        const user = this.userController.getUser(userID)
        if (user && user.streams[streamType]) {
          Object.assign(user.streams[streamType], config)
          // user.streams引用的对象和 streamList 里的是同一个
          this.setData({
            streamList: this.data.streamList
          }, () => {
            // console.log(TAG_NAME, '_setPlayerConfig complete', params, 'streamList:', this.data.streamList)
            resolve(params)
          })
        } else {
          // 不需要reject，静默处理
          console.warn(TAG_NAME, '指定 userID 或者 streamType 不存在')
          // reject(new Error('指定 userID 或者 streamType 不存在'))
        }
      })
    },
    /**
     * 设置列表数据，并触发页面渲染
     * @param {Object} params include userList, stramList
     * @returns {Promise}
     */
    _setList(params) {
      console.log(TAG_NAME, '_setList', params, this.data.template)
      const { userList, streamList } = params
      return new Promise((resolve, reject) => {
        let visibleStreamList = []
        const data = {
          userList: userList || this.data.userList,
          streamList: streamList || this.data.streamList,
        }
        this.setData(data, () => {
          resolve(params)
        })
      })
    },
    /**
     * 必选参数检测
     * @param {Object} rtcConfig rtc参数
     * @returns {Boolean}
     */
    _checkParam(rtcConfig) {
      console.log(TAG_NAME, 'checkParam config:', rtcConfig)
      if (!rtcConfig.sdkAppID) {
        console.error('未设置 sdkAppID')
        return false
      }
      if (rtcConfig.roomID === undefined) {
        console.error('未设置 roomID')
        return false
      }
      if (rtcConfig.roomID < 1 || rtcConfig.roomID > 4294967296) {
        console.error('roomID 超出取值范围 1 ~ 4294967295')
        return false
      }
      if (!rtcConfig.userID) {
        console.error('未设置 userID')
        return false
      }
      if (!rtcConfig.userSig) {
        console.error('未设置 userSig')
        return false
      }
      if (!rtcConfig.template) {
        console.error('未设置 template')
        return false
      }
      return true
    },
    _getPushUrl(rtcConfig) {
      // 拼接 puhser url rtmp 方案
      console.log(TAG_NAME, '_getPushUrl', rtcConfig)
      if (ENV.IS_TRTC) {
        // 版本高于7.0.8，基础库版本高于2.10.0 使用新的 url
        return new Promise((resolve, reject) => {
          // appscene videocall live
          // cloudenv PRO CCC DEV UAT
          // encsmall 0
          // 对外的默认值是rtc ，对内的默认值是videocall
          rtcConfig.scene = !rtcConfig.scene || rtcConfig.scene === 'rtc' ? 'videocall' : rtcConfig.scene
          rtcConfig.enableBlackStream = rtcConfig.enableBlackStream || '' // 是否支持在纯音频下推送SEI消息，注意：在关闭enable-recv-message后还是无法接收
          rtcConfig.encsmall = rtcConfig.encsmall || 0 // 是否编小画面，这个特性不建议学生默认开启，只有老师端才比较有意义
          rtcConfig.cloudenv = rtcConfig.cloudenv || 'PRO'
          rtcConfig.streamID = rtcConfig.streamID || '' // 指定旁边路直播的流ID
          rtcConfig.userDefineRecordID = rtcConfig.userDefineRecordID || '' // 指定录制文件的recordid
          rtcConfig.privateMapKey = rtcConfig.privateMapKey || '' // 字符串房间号
          rtcConfig.pureAudioMode = rtcConfig.pureAudioMode || ''// 指定是否纯音频推流及录制，默认不填，值为1 或 2，其他值非法不处理
          rtcConfig.recvMode = rtcConfig.recvMode || 1 // 1. 自动接收音视频 2. 仅自动接收音频 3. 仅自动接收视频 4. 音视频都不自动接收, 不能绑定player
          let roomID = ''
          if (/^\d+$/.test(rtcConfig.roomID)) {
            // 数字房间号
            roomID = '&roomid=' + rtcConfig.roomID
          } else {
            // 字符串房间号
            roomID = '&strroomid=' + rtcConfig.roomID
          }
          setTimeout(()=> {
            const pushUrl = 'room://cloud.tencent.com/rtc?sdkappid=' + rtcConfig.sdkAppID +
                            roomID +
                            '&userid=' + rtcConfig.userID +
                            '&usersig=' + rtcConfig.userSig +
                            '&appscene=' + rtcConfig.scene +
                            '&encsmall=' + rtcConfig.encsmall +
                            '&cloudenv=' + rtcConfig.cloudenv +
                            '&enableBlackStream=' + rtcConfig.enableBlackStream +
                            '&streamid=' + rtcConfig.streamID +
                            '&userdefinerecordid=' + rtcConfig.userDefineRecordID +
                            '&privatemapkey=' + rtcConfig.privateMapKey +
                            '&pureaudiomode=' + rtcConfig.pureAudioMode +
                            '&recvmode=' + rtcConfig.recvMode
            console.warn(TAG_NAME, 'getPushUrl result:', pushUrl)
            resolve(pushUrl)
          }, 0)
        })
      }
      console.error(TAG_NAME, '组件仅支持微信 App iOS >=7.0.9, Android >= 7.0.8, 小程序基础库版 >= 2.10.0')
      console.error(TAG_NAME, '需要真机运行，开发工具不支持实时音视频')
    },
    /**
     * TRTC-room 远端用户和音视频状态处理
     */
    _bindEvent() {
      // 远端用户进房
      this.userController.on(EVENT.REMOTE_USER_JOIN, (event)=>{
        console.log(TAG_NAME, '远端用户进房', event, event.data.userID)
        let count = 0;
        
        this.setData({
          userList: event.data.userList,
          isConnectioned: true,
          canIHangUp: false,
          isRemotIn: true
        }, () => {
          // 接通后开始的计时！
          this.data.timerInstance = setInterval(() => {
            const formatTimer = this.secondToDate(++this.data.timer);

            // 10s后可以挂断
            if (this.data.timer == 10) {
              this.setData({
                canIHangUp: true
              })
            }

            this.setData({ 
              formatTimer
            });
          }, 1000)

          this._emitter.emit(EVENT.REMOTE_USER_JOIN, { userID: event.data.userID })
        })
        console.log(TAG_NAME, 'REMOTE_USER_JOIN', 'streamList:', this.data.streamList, 'userList:', this.data.userList)
      })
      // 远端用户离开
      this.userController.on(EVENT.REMOTE_USER_LEAVE, (event)=>{
        console.log(TAG_NAME, '远端用户离开', event, event.data.userID)
        const _this = this;
        if (event.data.userID) {
          this._setList({
            userList: event.data.userList,
            streamList: event.data.streamList
          }).then(() => {
            wx.showToast({
              title: '问诊已结束',
              icon: 'none'
            })

            // 远端挂断逻辑处理
            this.setData({
              isRemotIn: false
            }, () => {
              console.log('问诊已结束，to 问诊详情');

              _this.toDetail();
            });

            this._emitter.emit(EVENT.REMOTE_USER_LEAVE, { userID: event.data.userID })
          })
        }
        console.log(TAG_NAME, 'REMOTE_USER_LEAVE', 'streamList:', this.data.streamList, 'userList:', this.data.userList)
      })
      // 视频状态 true
      this.userController.on(EVENT.REMOTE_VIDEO_ADD, (event)=>{
        console.log(TAG_NAME, '远端视频可用', event, event.data.stream.userID)
        const stream = event.data.stream
        // 如果Android onHide 时，新增的player 无法播放 记录标识位
        if (this.status.pageLife === 'hide') {
          this.status.isOnHideAddStream = true
          stream.isOnHideAdd = true
        }
        this._setList({
          userList: event.data.userList,
          streamList: event.data.streamList,
        }).then(() => {
          // 完善 的stream 的 playerContext
          stream.playerContext = wx.createLivePlayerContext(stream.streamID, this)
          // 新增的需要触发一次play 默认属性才能生效
          // stream.playerContext.play()
          // console.log(TAG_NAME, 'REMOTE_VIDEO_ADD playerContext.play()', stream)
          this._emitter.emit(EVENT.REMOTE_VIDEO_ADD, { userID: stream.userID, streamType: stream.streamType })
        })
        console.log(TAG_NAME, 'REMOTE_VIDEO_ADD', 'streamList:', this.data.streamList, 'userList:', this.data.userList)
      })
      // 视频状态 false
      this.userController.on(EVENT.REMOTE_VIDEO_REMOVE, (event)=>{
        console.log(TAG_NAME, '远端视频移除', event, event.data.stream.userID)
        const stream = event.data.stream

        // 远端视频移除时 给患者端提示 为区分挂断 还是 切语音 需要判定远端是否还在房间
        if (this.data.isRemotIn) {
          wx.showToast({
            title: '医生端摄像头关闭',
            duration: 5000,
            icon: 'none'
          })          
        }

        this._setList({
          userList: event.data.userList,
          streamList: event.data.streamList,
        }).then(() => {
          // 有可能先触发了退房事件，用户名下的所有stream都已清除
          if (stream.userID && stream.streamType) {
            this._emitter.emit(EVENT.REMOTE_VIDEO_REMOVE, { userID: stream.userID, streamType: stream.streamType })
          }
        })
        console.log(TAG_NAME, 'REMOTE_VIDEO_REMOVE', 'streamList:', this.data.streamList, 'userList:', this.data.userList)
      })
      // 音频可用
      this.userController.on(EVENT.REMOTE_AUDIO_ADD, (event)=>{
        console.log(TAG_NAME, '远端音频可用', event)
        const stream = event.data.stream
        this._setList({
          userList: event.data.userList,
          streamList: event.data.streamList,
        }).then(() => {
          stream.playerContext = wx.createLivePlayerContext(stream.streamID, this)
          // 新增的需要触发一次play 默认属性才能生效
          // stream.playerContext.play()
          // console.log(TAG_NAME, 'REMOTE_AUDIO_ADD playerContext.play()', stream)
          this._emitter.emit(EVENT.REMOTE_AUDIO_ADD, { userID: stream.userID, streamType: stream.streamType })
        })
        console.log(TAG_NAME, 'REMOTE_AUDIO_ADD', 'streamList:', this.data.streamList, 'userList:', this.data.userList)
      })
      // 音频不可用
      this.userController.on(EVENT.REMOTE_AUDIO_REMOVE, (event)=>{
        console.log(TAG_NAME, '远端音频移除', event, event.data.stream.userID)
        const stream = event.data.stream
        this._setList({
          userList: event.data.userList,
          streamList: event.data.streamList,
        }).then(() => {
          // 有可能先触发了退房事件，用户名下的所有stream都已清除
          if (stream.userID && stream.streamType) {
            this._emitter.emit(EVENT.REMOTE_AUDIO_REMOVE, { userID: stream.userID, streamType: stream.streamType })
          }
        })
        console.log(TAG_NAME, 'REMOTE_AUDIO_REMOVE', 'streamList:', this.data.streamList, 'userList:', this.data.userList)
      })
    },
    /**
     * pusher event handler
     * @param {*} event 事件实例
     */
    _pusherStateChangeHandler(event) {
      const code = event.detail.code
      const message = event.detail.message
      console.log(TAG_NAME, 'pusherStateChange：', code, event)
      switch (code) {
        case 0: // 未知状态码，不做处理
          console.log(TAG_NAME, message, code)
          break
        case 1001:
          console.log(TAG_NAME, '已经连接推流服务器', code)
          break
        case 1002:
          console.log(TAG_NAME, '已经与服务器握手完毕,开始推流', code)
          break
        case 1003:
          console.log(TAG_NAME, '打开摄像头成功', code)
          break
        case 1004:
          console.log(TAG_NAME, '录屏启动成功', code)
          break
        case 1005:
          console.log(TAG_NAME, '推流动态调整分辨率', code)
          break
        case 1006:
          console.log(TAG_NAME, '推流动态调整码率', code)
          break
        case 1007:
          console.log(TAG_NAME, '首帧画面采集完成', code)
          break
        case 1008:
          console.log(TAG_NAME, '编码器启动', code)
          break
        case 1018:
          console.log(TAG_NAME, '进房成功', code)
          this._emitter.emit(EVENT.LOCAL_JOIN, { userID: this.data.pusher.userID })
          break
        case 1019:
          console.log(TAG_NAME, '退出房间', code)
          // 20200421 iOS 仍然没有1019事件通知退房，退房事件移动到 exitRoom 方法里，但不是后端通知的退房成功
          // this._emitter.emit(EVENT.LOCAL_LEAVE, { userID: this.data.pusher.userID })
          break
        case 2003:
          console.log(TAG_NAME, '渲染首帧视频', code)
          break
        case 1020:
        case 1031:
        case 1032:
        case 1033:
        case 1034:
          // 通过 userController 处理 1020 1031 1032 1033 1034
          this.userController.userEventHandler(event)
          break
        case -1301:
          console.error(TAG_NAME, '打开摄像头失败: ', code)
          this._emitter.emit(EVENT.ERROR, { code, message })
          break
        case -1302:
          console.error(TAG_NAME, '打开麦克风失败: ', code)
          this._emitter.emit(EVENT.ERROR, { code, message })
          break
        case -1303:
          console.error(TAG_NAME, '视频编码失败: ', code)
          this._emitter.emit(EVENT.ERROR, { code, message })
          break
        case -1304:
          console.error(TAG_NAME, '音频编码失败: ', code)
          this._emitter.emit(EVENT.ERROR, { code, message })
          break
        case -1307:
          console.error(TAG_NAME, '推流连接断开: ', code)
          this._emitter.emit(EVENT.ERROR, { code, message })
          break
        case -100018:
          console.error(TAG_NAME, '进房失败: userSig 校验失败，请检查 userSig 是否填写正确', code, message)
          this._emitter.emit(EVENT.ERROR, { code, message })
          break
        case 5000:
          console.log(TAG_NAME, '小程序被挂起: ', code)
          // 20200421 iOS 微信点击胶囊圆点会触发该事件
          // 触发 5000 后，底层SDK会退房，返回前台后会自动进房
          break
        case 5001:
          // 20200421 仅有 Android 微信会触发该事件
          console.log(TAG_NAME, '小程序悬浮窗被关闭: ', code)
          this.status.isPending = true
          if (this.status.isPush) {
            this.exitRoom()
          }
          break
        case 1021:
          console.log(TAG_NAME, '网络类型发生变化，需要重新进房', code)
          break
        case 2007:
          console.log(TAG_NAME, '本地视频播放loading: ', code)
          break
        case 2004:
          console.log(TAG_NAME, '本地视频播放开始: ', code)
          break
        default:
          console.log(TAG_NAME, message, code)
      }
    },
    _pusherNetStatusHandler(event) {
      // 触发 LOCAL_NET_STATE_UPDATE
      this._emitter.emit(EVENT.LOCAL_NET_STATE_UPDATE, event)
    },
    _pusherErrorHandler(event) {
      // 触发 ERROR
      console.warn(TAG_NAME, 'pusher error', event)
      try {
        const code = event.detail.errCode
        const message = event.detail.errMsg
        this._emitter.emit(EVENT.ERROR, { code, message })
      } catch (exception) {
        console.error(TAG_NAME, 'pusher error data parser exception', event, exception)
      }
    },
    _pusherBGMStartHandler(event) {
      // 触发 BGM_START 已经在playBGM方法中进行处理
      this._emitter.emit(EVENT.BGM_PLAY_START, { data: event })
    },
    _pusherBGMProgressHandler(event) {
      // BGM_PROGRESS
      this._emitter.emit(EVENT.BGM_PLAY_PROGRESS, event)
    },
    _pusherBGMCompleteHandler(event) {
      // BGM_COMPLETE
      this._emitter.emit(EVENT.BGM_PLAY_COMPLETE, event)
    },
    _pusherAudioVolumeNotify: function(event) {
      // console.log(TAG_NAME, '_pusherAudioVolumeNotify', event)
      this._emitter.emit(EVENT.LOCAL_AUDIO_VOLUME_UPDATE, event)
    },
    // player event handler
    // 获取 player ID 再进行触发
    _playerStateChange(event) {
      // console.log(TAG_NAME, '_playerStateChange', event)
      this._emitter.emit(EVENT.REMOTE_STATE_UPDATE, event)
    },
    _playerFullscreenChange(event) {
      // console.log(TAG_NAME, '_playerFullscreenChange', event)
      this._emitter.emit(EVENT.REMOTE_FULLSCREEN_UPDATE, event)
      this._emitter.emit(EVENT.VIDEO_FULLSCREEN_UPDATE, event)
    },
    _playerNetStatus(event) {
      // console.log(TAG_NAME, '_playerNetStatus', event)
      // 获取player 视频的宽高
      const stream = this.userController.getStream({
        userID: event.currentTarget.dataset.userid,
        streamType: event.currentTarget.dataset.streamtype,
      })
      if (stream && (stream.videoWidth !== event.detail.info.videoWidth || stream.videoHeight !== event.detail.info.videoHeight)) {
        console.log(TAG_NAME, '_playerNetStatus update video size', event)
        stream.videoWidth = event.detail.info.videoWidth
        stream.videoHeight = event.detail.info.videoHeight
      }
      this._emitter.emit(EVENT.REMOTE_NET_STATE_UPDATE, event)
    },
    _playerAudioVolumeNotify(event) {
      // console.log(TAG_NAME, '_playerAudioVolumeNotify', event)
      this._emitter.emit(EVENT.REMOTE_AUDIO_VOLUME_UPDATE, event)
    },
    _filterGridPageVisibleStream(list) {
      // 最多只显示 gridPlayerPerPage 个stream
      const length = list.length
      // +1 pusher
      this.data.gridPageCount = Math.ceil((length + 1) / this.data.gridPlayerPerPage)
      this.data.gridPagePlaceholderStreamList = []
      let visibleCount = 0
      // 需要显示的player区间
      let interval
      if (this.data.gridPlayerPerPage > 3) {
        if (this.data.gridCurrentPage === 1) {
          interval = [-1, this.data.gridPlayerPerPage - 1]
        } else {
          // 每页显示4个时，第一页显示3个，pusher只在第一页
          // -1 0 1 2 3 4 5 6 7 8 9 10 11 12 13 14
          //    1     2       3        4
          // -1 3
          // 2 7
          // 6 11
          interval = [this.data.gridCurrentPage * this.data.gridPlayerPerPage - (this.data.gridPlayerPerPage + 2), this.data.gridCurrentPage * this.data.gridPlayerPerPage - 1]
        }
      } else {
        // 每页显示3个，每页都有pusher
        interval = [this.data.gridCurrentPage * this.data.gridPlayerPerPage - (this.data.gridPlayerPerPage + 1), this.data.gridCurrentPage * this.data.gridPlayerPerPage]
      }

      for (let i = 0; i < length; i++) {
        if ( i > interval[0] && i < interval[1]) {
          list[i].isVisible = true
          list[i].muteVideo = list[i].muteVideoPrev === undefined ? list[i].muteVideo : list[i].muteVideoPrev
          visibleCount++
        } else {
          list[i].isVisible = false
          list[i].muteVideo = true
        }
      }
      // 第一页，不需要占位
      if (this.data.gridCurrentPage !== 1) {
        for (let i = 0; i < this.data.gridPlayerPerPage - visibleCount; i++) {
          this.data.gridPagePlaceholderStreamList.push({ id: 'holder-' + i })
        }
      }
      return list
    },
    /**
     * 保持屏幕常亮
     */
    _keepScreenOn() {
      setInterval(() => {
        wx.setKeepScreenOn({
          keepScreenOn: true,
        })
      }, 20000)
    },
    
    //  ________                                  __             __
    //  |        \                                |  \           |  \
    //   \$$$$$$$$______   ______ ____    ______  | $$  ______  _| $$_     ______
    //     | $$  /      \ |      \    \  /      \ | $$ |      \|   $$ \   /      \
    //     | $$ |  $$$$$$\| $$$$$$\$$$$\|  $$$$$$\| $$  \$$$$$$\\$$$$$$  |  $$$$$$\
    //     | $$ | $$    $$| $$ | $$ | $$| $$  | $$| $$ /      $$ | $$ __ | $$    $$
    //     | $$ | $$$$$$$$| $$ | $$ | $$| $$__/ $$| $$|  $$$$$$$ | $$|  \| $$$$$$$$
    //     | $$  \$$     \| $$ | $$ | $$| $$    $$| $$ \$$    $$  \$$  $$ \$$     \
    //      \$$   \$$$$$$$ \$$  \$$  \$$| $$$$$$$  \$$  \$$$$$$$   \$$$$   \$$$$$$$
    //                                  | $$
    //                                  | $$
    //                                   \$$
    // 以下为 debug & template 相关函数
    _toggleAudio() {
      if (this.data.pusher.enableMic) {
        this.unpublishLocalAudio()
      } else {
        this.publishLocalAudio()
      }
    },
    _debugToggleRemoteVideo(event) {
      console.log(TAG_NAME, '_debugToggleRemoteVideo', event.currentTarget.dataset)
      const userID = event.currentTarget.dataset.userID
      const streamType = event.currentTarget.dataset.streamType
      const stream = this.data.streamList.find((item)=>{
        return item.userID === userID && item.streamType === streamType
      })
      if (stream.muteVideo) {
        this.subscribeRemoteVideo({ userID, streamType })
        // this.setViewVisible({ userID, streamType, isVisible: true })
      } else {
        this.unsubscribeRemoteVideo({ userID, streamType })
        // this.setViewVisible({ userID, streamType, isVisible: false })
      }
    },
    _debugToggleRemoteAudio(event) {
      console.log(TAG_NAME, '_debugToggleRemoteAudio', event.currentTarget.dataset)
      const userID = event.currentTarget.dataset.userID
      const streamType = event.currentTarget.dataset.streamType
      const stream = this.data.streamList.find((item)=>{
        return item.userID === userID && item.streamType === streamType
      })
      if (stream.muteAudio) {
        this.subscribeRemoteAudio({ userID })
      } else {
        this.unsubscribeRemoteAudio({ userID })
      }
    },
    _debugToggleVideoDebug() {
      this.setData({
        debug: !this.data.debug,
      })
    },
    _debugExitRoom() {
      this.exitRoom()
    },
    _debugEnterRoom() {
      Object.assign(this.data.pusher, this.data.config)
      this.enterRoom({ roomID: this.data.config.roomID }).then(()=>{
        setTimeout(()=>{
          this.publishLocalVideo()
          this.publishLocalAudio()
        }, 2000)
        // 进房后开始推送视频或音频
      })
    },
    _debugGoBack() {
      wx.navigateBack({
        delta: 1,
      })
    },
    _debugTogglePanel() {
      this.setData({ 
        debugPanel: !this.data.debugPanel,
      })
    },
    _toggleAudioVolumeType() {
      if (this.data.pusher.audioVolumeType === 'voicecall') {
        this._setPusherConfig({
          audioVolumeType: 'media',
        })
      } else {
        this._setPusherConfig({
          audioVolumeType: 'voicecall',
        })
      }
    },
    _toggleSoundMode() {
      if (this.data.userList.length === 0 ) {
        return
      }
      const stream = this.userController.getStream({
        userID: this.data.userList[0].userID,
        streamType: 'main',
      })
      if (stream) {
        if (stream.soundMode === 'speaker') {
          stream['soundMode'] = 'ear'
        } else {
          stream['soundMode'] = 'speaker'
        }
        this._setPlayerConfig({
          userID: stream.userID,
          streamType: 'main',
          config: {
            soundMode: stream['soundMode'],
          },
        })
      }
    },
    /**
     * 秒转时分秒
     */
    secondToDate(result) {
      let h = Math.floor(result / 3600) < 10 ? '0'+Math.floor(result / 3600) : Math.floor(result / 3600);
      let m = Math.floor((result / 60 % 60)) < 10 ? '0' + Math.floor((result / 60 % 60)) : Math.floor((result / 60 % 60));
      let s = Math.floor((result % 60)) < 10 ? '0' + Math.floor((result % 60)) : Math.floor((result % 60));
      return result = h + ":" + m + ":" + s;
    },
    /**
     * 退出通话
     */
    _hangUp() {
      let _this = this;

      if (this.data.canIHangUp && !this.data.isConnectioned) { // 能挂断 而且 远端没进房间
        // 患者未接通挂断
        wx.showModal({
          title: '提示',
          content: '正在为您派单，是否中断问诊?',
          showCancel: true,
          confirmColor: '#F65455',
          success: function(res) {
            if (res.cancel) return;

            wx.navigateBack({ // 触发 detached 生命周期，调取消问诊接口并退出房间。 提示 "问诊已取消"
              delta: 1,
            })
          }
        })
        return;
      } else if (!this.data.canIHangUp && this.data.isConnectioned) { // 不能挂断 而且 远端在
        // 患者接通挂断
        wx.showToast({
          title: '10秒内无法结束问诊',
          icon: 'none'
        })
        return;
      }

      this.data.isClickBtnToHangeUp = true; // 标识为患者端按钮点击挂断
      // 接诊结束正常挂断 toast提示 进入问诊详情页
      wx.showToast({
        title: '问诊已结束',
        icon: 'none'
      })

      setTimeout(() => {
        _this.exitRoom();
        // to 处方详情
        console.log('患者端主动挂断，问诊结束，to 问诊详情');
        this.toDetail();
      }, 1000);
    },
    toDetail() {
      const { inquiryReportGuid } =  wx.getStorageSync('inqueryInfo') || {};
      wx.redirectTo({
        url: '/pages/inquiry/prescriptionDetails/prescriptionDetails?inquiryType=video&inquiryId=' + inquiryReportGuid,
      })
    },
    /**
     * @description 视频还未接通时 取消问诊
     */
    cancleInquery() {
      const { roomNumber, patientGuid, inquiryReportGuid: inquiryRecordGuid } =  wx.getStorageSync('inqueryInfo') || {};
      const _this = this;

      ajax2('post', '/api/patientinfo/cancelInquiry', { roomNumber, patientGuid, inquiryRecordGuid }, res => {
        console.log('res', res)
        if (res.data.code === 0) {
          // wx.navigateBack({
          //   delta: 1,
          // })
        } else {
          wx.showToast({
            title: res.data.msg || '操作失败',
            icon: 'none'
          })
        }
      }, err => {
        wx.showToast({
          title: err.msg || '操作失败',
          icon: 'none'
        })
      })
    }
  }
})
