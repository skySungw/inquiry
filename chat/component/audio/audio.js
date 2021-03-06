let audioCtxFc = require("audioCtxFactory");
let playStatus = require("playStatus");

if (wx.setInnerAudioOption) {
  wx.setInnerAudioOption({
    obeyMuteSwitch: false,
    autoplay: true
  })
}
Component({
	properties: {
		msg: {
			type: Object,
			val: {}
		},
    isSelf: {
      type: Boolean,
      val: true
    }
	},
	data: {
		playStatus: playStatus,
		curStatus: playStatus.STOP,
		time: "0'",
		opcity: 1,
		__comps__: {
			audioCtx: null,
		}
	},
	methods: {
		audioPlay(){
			wx.inter && clearInterval(wx.inter)
			let audioCtx = this.data.__comps__.audioCtx;
			var curl = ''
			console.log('audio:', this.data.msg.msg.data)
			wx.downloadFile({
			url: this.data.msg.msg.data,
			header: {
				"X-Requested-With": "XMLHttpRequest",
				Accept: "audio/mp3",
				Authorization: "Bearer " + this.data.msg.msg.token
			},
			success(res){
				curl = res.tempFilePath;
				console.log('audio url:', curl)
				audioCtx.src = curl;
				audioCtx.play();
				
			},
			fail(e){
				wx.showToast({
					title: "播放失败",
					duration: 1000
				});
			}
		});
		
		},

		audioPause(auCtx){
			//let audioCtx = this.data.__comps__.audioCtx;
			let audioCtx = this.data.__comps__.audioCtx = audioCtxFc.getCtx(this.data.msg.mid) || auCtx
			audioCtx&&audioCtx.pause();
		},

		addEvent(){
			let audioCtx = this.data.__comps__.audioCtx;
			audioCtx.onPlay(this.onPlaying);
			audioCtx.onPause(this.onPause);
			audioCtx.onWaiting(this.onPause);
			audioCtx.onStop(this.onDone);
			audioCtx.onEnded(this.onDone);
			audioCtx.onError(this.onDone);
			audioCtx.onWaiting(this.onWait)
			//audioCtx.onTimeUpdate(this.onTimeUpdate);
		},

		delEvent(){
			let audioCtx = this.data.__comps__.audioCtx;
			audioCtx.offPlay(this.onPlaying);
			audioCtx.offPause(this.onPause);
			audioCtx.offWaiting(this.onPause);
			audioCtx.offStop(this.onDone);
			audioCtx.offEnded(this.onDone);
			audioCtx.offError(this.onDone);
			audioCtx.offWaiting(this.onWait);
		},
	},
	attached(){
		this.setData({
			time: this.properties.msg.msg.length + "''",
			style: this.properties.msg.style
		})
	},
	detached(){
		
		let audioCtx = this.data.__comps__.audioCtx = audioCtxFc.getCtx(this.data.msg.mid);
		this.audioPause(audioCtx);
		this.delEvent();
	},
	ready(){
		let self = this
		let curl = ''
		let audioCtx = this.data.__comps__.audioCtx = audioCtxFc.getCtx(this.data.msg.mid);
		
		audioCtx.autoplay = false;
		audioCtx.loop = false;
		//
		this.onPlaying = () => {
			this.setData({
				curStatus: playStatus.PLAYING,
			});
			wx.inter && clearInterval(wx.inter)
			wx.inter = setInterval(() => {
				let opcity = this.data.opcity;
				this.setData({
					opcity: opcity == 1 ? 0.4 : 1
				})
			}, 500)
		};
		this.onPause = () => {
			// 第二次播放会立即抛出一个异常的 onPause
			if(parseInt(this.data.time, 10) < 1){
				return;
			}
			this.setData({
				curStatus: playStatus.PAUSE,
				opcity: 1
				//time: "0'",
			});
		};
		this.onDone = () => {
			// console.log("onDone", JSON.stringify(this.data));
			this.setData({
				curStatus: playStatus.STOP,
				opcity: 1
				//time: "0'",
			});
			clearInterval(wx.inter)
		};
		// 多次播放会丢失这个回调
		this.onTimeUpdate = () => {
			this.setData({
				time: (audioCtx.currentTime >> 0) + "'"
			});
		};
		this.onWait = () => {
			wx.showToast({
				title: "加载中...",
				icon: "none",
				duration: 1000
			});
		}
		this.addEvent();
	},
});

