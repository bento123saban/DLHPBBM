

class main {
    constructor() {
        this.state          = "scan"
        this.scannerCtrl    = new QRScanner()
        this.codeHandler    = new codeHandler()
        this.dataCtrl       = new dataCtrl()
        this.appScript      = "https://script.google.com/macros/s/AKfycbxeiKcPU2x_l7WWyfEDGeXqcRZfTb7kXY9rpk_c5K3BlG45HNLyY_Ym_AuLNXRfC-2Bag/exec"
    }
    async myPost(data ) {
        if(!data) return console.log("Data for fetch Undefined")
        const proxy = "https://bbmctrl.dlhpambon2025.workers.dev?url=" + encodeURIComponent(this.appScript);
        const response = await fetch(proxy, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data)
        });
        return await response.json();
    }
    async start () {
        const loaderText = document.querySelector('.loader-text')
        document.querySelector(".loader-box").classList.remove("dis-none")
        setInterval(async () => {
            const link = "https://script.google.com/macros/s/AKfycbz5P2ja4r_-J60WUv0tSMIYiKz71VZLlLAYuihDWvyN3B31yKprtDZW83QagYfGAekCXQ/exec";
            const start = performance.now();
            try {
                await fetch(link, { method: "POST", body: "tesPing" });
                const end = performance.now();
                document.querySelector('.ping-text').textContent = `${Math.round(end - start)} ms`
                document.querySelector('#code-search-ping').textContent = `${Math.round(end - start)} ms`
            } catch {
                console.log("Ping gagal (server tidak bisa diakses)");
                window.location.reload()
            }
        } ,1000);
        loaderText.textContent = 'Configure'
        await new Promise(r => setTimeout(r, 1000))
        loaderText.textContent = 'Connect to server'
        await new Promise(r => setTimeout(r, 3000))
        return true        
    }
    on (elm) {
        if(!elm) return console.log("On elm empty")
        document.querySelectorAll(".main-bg, header, #scan, #code-input, #content, #after-box, .loader-box").forEach(elm => elm.classList.add("dis-none"))
        document.querySelector(elm).classList.remove("dis-none")
    }
    off (elm) {
        if(!elm) return console.log("OFF elm empty")
        document.querySelector(elm).classList.add("dis-none")        
    }
    async init () {
        window.addEventListener("DOMContentLoaded", async () => {
            document.querySelectorAll(".to-code-input").forEach(btn => {
                btn.onclick = () => (btn.dataset.param == "active") ? this.codeHandler.run() : ""
            })
            document.querySelectorAll(".to-scan-input").forEach(btn => {
                btn.onclick = () => (btn.dataset.param == "active") ? this.QRScanner.run() : "" 
            })
            await this.run()
        })
    }
    async run () {
        console.log("run")
        await this.start()
        const scan = this.scannerCtrl.run()
        if(!scan) {
            this.on("#code-input")
            this.codeHandler.run()
        }
        this.on("#scan")
    }
}

class QRScanner {
    constructor(readerId = "reader") {
        this.readerId = readerId;
        this.html5QrCode = new Html5Qrcode(this.readerId);
        this.cameras = [];
        this.currentCamIndex = 0;
        this.isScanning = false;
    }
    async initCameras() {
        this.cameras = await Html5Qrcode.getCameras();
        if (this.cameras.length === 0) {
            console.log("Tidak ada kamera ditemukan");
        } else {
            console.log(`${this.cameras.length} kamera ditemukan`);
        }
    }
    async startScanner() {
        if (this.cameras.length === 0) {
            console.log("Tidak ada kamera ditemukan");
            return;
        }
        this.isScanning = true;
        document.getElementById("toggle-btn").classList.add("active");

        await this.html5QrCode.start(
            { deviceId: { exact: this.cameras[this.currentCamIndex].id } },
            { fps: 60, qrbox: { width: 350, height: 500 } },
            (decodedText) => {
                document.getElementById("result").innerText = `Hasil: ${decodedText}`;
                this.encodeCheck(decodedText)
            },
            (error) => {
                //console.log(error);
            }
        );
    }
    async stopScanner() {
        this.isScanning = false;
        document.getElementById("toggle-btn").classList.remove("active");
        await this.html5QrCode.stop();
        this.html5QrCode.clear();
    }

    async cekKameraTersedia() {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const kameraAda = devices.some(device => device.kind === 'videoinput');
            if (kameraAda) {
                console.log('Kamera terdeteksi.');
                return { status: true, state: 'detected', msg: 'Kamera terdeteksi.' };
            } else {
                console.warn('Tidak ada kamera terdeteksi di perangkat ini');
                return { status: false, state: 'not detected', msg: 'Tidak ada kamera terdeteksi di perangkat ini' };
            }
        } catch (err) {
            console.error('Gagal mendeteksi perangkat:', err);
            return { status: false, state: "error", msg: 'Gagal mendeteksi perangkat: ' + err };
        }
    }
    async cekIzinKamera() {
        try {
            const status = await navigator.permissions.query({ name: 'camera' });
            console.log('Status izin kamera:', status.state);

            if (status.state === 'granted') {
                return { status: true, state: "granted", msg: "Kamera sudah diizinkan" };
            } else if (status.state === 'prompt') {
                return { status: false, state: "prompt", msg: "Meminta izin kamera..." };
            } else if (status.state === 'denied') {
                return { status: false, state: "denied", msg: "Akses kamera ditolak" };
            } else {
                return { status: false, state: "unsuppot", msg: "Permissions API tidak didukung" };
            }
        } catch (err) {
            console.error('Terjadi error saat cek izin kamera:', err);
            return { status: false, state: "error", msg: "Error cek izin kamera" };
        }
    }
    async permissions() {
        const camAvailable  = await this.cekKameraTersedia(),
            camPermisions   = await this.cekIzinKamera(),
            scanNotif       = document.querySelector("#scan-notif"),
            codeInputBox    = document.querySelector('#scan-code-input'),
            codeInputSpan   = document.querySelector('#scan-code-input span'),
            loaderBox       = document.querySelector('.loader-box')
   
        if (!camAvailable.status) {
            scanNotif.classList.remove('dis-none')
            codeInputBox.classList.remove('dis-none')
            codeInputBox.querySelector('h4').innerHTML = '<i class="fas fa-circle-excalamtion"></i> ' + camAvailable.msg
            return loaderBox.classList.add('dis-none')
        }
        else if (!camPermisions.status) {
            const camState  = camPermisions.state,
                camMsg        = camPermisions.msg
            
            if (camState == 'prompt') {
                scanNotif.classList.remove('dis-none')
                codeInputBox.classList.remove('dis-none')
                codeInputBox.querySelector('h4').innerHTML = '<i class="fas fa-circle-question"></i> Belum ada akses kamera'
                codeInputSpan.innerHTML = 'Akses kamera belum diberikan.<br>Silahkan ubah di pengaturan browser atau masukan <b class="fz-14">NOMOR LAMBUNG</b> untuk melanjutkan'
                loaderBox.classList.add('dis-none')
            }
            else if (camState == 'denied') {
                scanNotif.classList.remove('dis-none')
                codeInputBox.classList.remove('dis-none')
                codeInputBox.querySelector('h4').innerHTML = '<i class="fas fa-triangle-exclamation"></i> &nbsp;Akses kamera ditolak'
                codeInputSpan.innerHTML = 'Akses kamera ditolak. Silahkan ubah di pengaturan browser untuk memberikan izin kamera atau masukan <i>nomor lambung</i> untuk melanjutkan'
                loaderBox.classList.add('dis-none')
            }
            else if (camState == 'unsuppot') {
                scanNotif.classList.remove('dis-none')
                codeInputBox.classList.remove('dis-none')
                codeInputBox.querySelector('h4').innerHTML = '<i class="fas fa-circle-xmark"></i> ' + camMsg
                codeInputSpan.innerHTML = 'Versi broser ini tidak mendukung penggunaan kamera.<br>Update browser ke versi terbaru atau masukan <b class="fz-14">NOMOR LAMBUNG</b> untuk melanjutkan'
                loaderBox.classList.add('dis-none')
            }
            else {
                scanNotif.classList.remove('dis-none')
                codeInputBox.classList.remove('dis-none')
                codeInputBox.querySelector('h4').innerHTML = '<i class="fas fa-circle-xmark"></i> - ' + camMsg
                codeInputSpan.innerHTML = 'Error : Internal Broser Error. <br>Masukan <b class="fz-14">NOMOR LAMBUNG</b> untuk melanjutkan'
                loaderBox.classList.add('dis-none')
            }
        }

        if (camAvailable.status || camPermisions.status) this.initCameras()
        return true
    }
    
    bindEvents() {
        document.getElementById("toggle-btn").addEventListener("click", async () => {
            if (this.isScanning) {
                await this.stopScanner();
            } else {
                await this.startScanner();
            }
        });

        document.getElementById("switch-camera").addEventListener("click", async () => {
            if (this.cameras.length < 2) return;
            this.currentCamIndex = (this.currentCamIndex + 1) % this.cameras.length;
            if (this.isScanning) {
                await this.stopScanner();
                await this.startScanner();
            }
        });

        document.getElementById("upload-btn").addEventListener("click", () => {
            document.getElementById("file-input").click();
        });

        document.getElementById("file-input").addEventListener("change", (e) => {
            if (e.target.files.length === 0) return alert('not-found');
            this.html5QrCode.scanFile(e.target.files[0], true)
                .then(decodedText => this.encodeCheck(decodedText))
                .catch(() => alert("QR tidak ditemukan pada gambar"));
        });

        window.addEventListener("online", () => console.log("Sekarang ONLINE"));
        window.addEventListener("offline", () => console.log("Sekarang OFFLINE"));
    }
    encodeCheck(encodeText) {
        const params = new URLSearchParams(encodeText);
        if (!params.has("data")) return false;
        try {
            const decoded = atob(params.get("data"));
            const data = JSON.parse(decoded);

            if (data.auth != "DLHP") return false;

            return new dataCtrl().scannerCtrl(data);
        } catch (e) {
            return false;
        }
    }

    async run() {
        await this.permissions()
        new main().on("#scan")
        this.bindEvents()
    }
    
}

/*
class codeHandler {
    constructor () {
        this.submit         = document.querySelector("#code-submit-button")
        this.inputs         = document.querySelectorAll(".code-inputer")
        this.bar            = document.querySelector("#code-search-bar")
        this.failedText     = document.querySelector("#code-search-failed")
        this.successText    = document.querySelector("#code-search-success")
    }
    init () {
        console.log("code-init")
        this.failedText.classList.add("dis-none")
        this.successText.classList.add("dis-none")
        this.bar.classList.add("dis-none")
        this.inputs.forEach((input, i) => {
            const updateClass = () => {
                if (input.value.trim() === "") {
                    input.classList.add("br-red");    
                    input.classList.remove("br-blue");
                } else {
                    input.classList.add("br-blue");
                    input.classList.remove("br-red");
                }
            };
            input.addEventListener("input", (e) => {
                const ins = e.target
                this.failedText.classList.add("dis-none")
                this.successText.classList.add("dis-none")
                this.bar.classList.add("dis-none")

                ins.value = ins.value.replace(/[^a-zA-Z0-9]/g, "")
                updateClass()
                setTimeout(() => (ins.value.length === 1 && i < ins.length - 1) ?  ins[i + 1].focus() : "", 0);
            });
            input.addEventListener("keydown", (e) => (e.key === "Backspace" && input.value === "" && i > 0) ? inputs[i - 1].focus() : "");
            input.addEventListener("blur", updateClass);
            //updateClass();
        });
        this.submit.onclick = (e) => {
            console.log("search")
            if(this.submit.dataset.param == "active") return console.log("on-request")
            this.submit.dataset.param = "active"
        
            console.log("xxx")
            let param = true
            this.inputs.forEach(input => {
                if (input.value != "") return input.classList.add("br-blue")
                input.classList.add("br-red")
                param = false   
            })
            if(!param) return
            const value = this.inputs[0].value + "-" + this.inputs[1].value + this.inputs[2].value + this.inputs[3].value
            return this.getData(value)
        }
    }
    async getData(code) {
        this.reqOn()
        const json = await new main().myPost({
                type: "get-driver",
                code: code
            });
        if (!json) this.reqFailed("Request gagal. Respon undefined")
        else if (!json.confirm) this.reqFailed(json.status + " - " + json.msg)
        else this.reqSuccess()
        console.log("JSON : " + json)
                
    }
    reqFailed(text) {
        this.failedText.classList.remove("dis-none")
        this.successText.classList.add("dis-none")
        this.bar.classList.add("dis-none")
        this.failedText.querySelector("span").textContent = text
        this.inputs.forEach(input => input.readOnly = false)
        this.submit.dataset.param = ""
        document.querySelectorAll(".to-code-input, .to-scan-input").forEach(btn => btn.dataset.param = "")
    }
    reqSuccess() {
        this.failedText.classList.add("dis-none")
        this.successText.classList.remove("dis-none")
        this.bar.classList.add("dis-none")
        this.inputs.forEach(input => input.readOnly = false)
        this.submit.dataset.param = ""
        document.querySelectorAll(".to-code-input, .to-scan-input").forEach(btn => btn.dataset.param = "")
        setTimeout(() => new dataCtrl().codeCtrl(json), 2000)
    }
    reqOn(){
        this.failedText.classList.add("dis-none")
        this.successText.classList.add("dis-none")
        this.bar.classList.remove("dis-none")
        this.inputs.forEach(input => input.readOnly = true)
        this.submit.dataset.param = "active"
        document.querySelectorAll(".to-code-input, .to-scan-input").forEach(btn => btn.dataset.param = "active")
    }
    run () {
        new main().on("#code-input")
        this.init()
    }
}*/

class codeHandler {
    constructor() {
        this.submit         = document.querySelector("#code-submit-button");
        this.inputs         = document.querySelectorAll(".code-inputer");
        this.bar            = document.querySelector("#code-search-bar");
        this.failedText     = document.querySelector("#code-search-failed");
        this.successText    = document.querySelector("#code-search-success");
        this.pingText       = document.querySelector("#code-search-ping");
    }

    init() {
        console.log("code-init");
        this.failedText.classList.add("dis-none");
        this.successText.classList.add("dis-none");
        this.bar.classList.add("dis-none");

        this.inputs.forEach((input, i) => {
            const updateClass = () => {
                if (input.value.trim() === "") {
                    input.classList.add("br-red");
                    input.classList.remove("br-blue");
                } else {
                    input.classList.add("br-blue");
                    input.classList.remove("br-red");
                }
            };

            input.addEventListener("input", (e) => {
                const ins = e.target;
                this.failedText.classList.add("dis-none");
                this.successText.classList.add("dis-none");
                this.bar.classList.add("dis-none");

                // hanya izinkan huruf dan angka
                ins.value = ins.value.replace(/[^a-zA-Z0-9]/g, "");
                updateClass();

                // pindah ke input berikutnya
                setTimeout(() => {
                    if (ins.value.length === 1 && i < this.inputs.length - 1) {
                        this.inputs[i + 1].focus();
                    }
                }, 0);
            });

            input.addEventListener("keydown", (e) => {
                if (e.key === "Backspace" && input.value === "" && i > 0) {
                    this.inputs[i - 1].focus();
                }
            });

            input.addEventListener("blur", updateClass);

            // inisialisasi warna
            //updateClass();
        });

        this.submit.onclick = (e) => {
            console.log("search");
            if (this.submit.dataset.param === "active") return console.log("on-request");
            this.submit.dataset.param = "active";

            let param = true;
            this.inputs.forEach(input => {
                if (input.value !== "") {
                    input.classList.add("br-blue");
                } else {
                    input.classList.add("br-red");
                    input.classList.remove("br-blue");
                    param = false;
                }
            });

            if (!param) {
                this.submit.dataset.param = "";
                return;
            }

            const code = this.inputs[0].value + "-" + this.inputs[1].value + this.inputs[2].value + this.inputs[3].value
            console.log("CODE : " + code)
            return this.getData(code.toUpperCase());
        };
    }

    async getData(code) {
        this.reqOn();

        const json = await new main().myPost({
            type: "getDriver",
            code: code
        });

        if (!json) {
            this.reqFailed("Request gagal. Respon undefined");
        } else if (!json.confirm) {
            this.reqFailed(json.status + " - " + json.msg);
        } else {
            this.reqSuccess(json.data);
        }

        console.log("JSON : ", json);
    }

    reqFailed(text) {
        console.log("failed")
        this.failedText.classList.remove("dis-none");
        this.successText.classList.add("dis-none");
        this.pingText.classList.add("dis-none");
        this.bar.classList.add("dis-none");
        this.failedText.querySelector("span").textContent = text;
        this.inputs.forEach(input => input.readOnly = false);
        this.submit.dataset.param = "";
        document.querySelectorAll(".to-code-input, .to-scan-input").forEach(btn => btn.dataset.param = "");
    }

    reqSuccess(data) {
        console.log("SCS : " + JSON.stringify(data.NAMA))
        this.failedText.classList.add("dis-none");
        this.successText.classList.remove("dis-none");
        this.pingText.classList.add("dis-none");
        this.bar.classList.add("dis-none");
        this.inputs.forEach(input => input.readOnly = false);
        this.submit.dataset.param = "";
        this.successText.querySelector("span").textContent = `Data driver ditemukan (${data.NAMA})`;
        document.querySelectorAll(".to-code-input, .to-scan-input").forEach(btn => btn.dataset.param = "");
        setTimeout(() => new dataCtrl().codeCtrl(data), 2000);
    }

    reqOn() {
        this.failedText.classList.add("dis-none");
        this.successText.classList.add("dis-none");
        this.pingText.classList.remove("dis-none");
        this.bar.classList.remove("dis-none");
        this.inputs.forEach(input => input.readOnly = true);
        this.submit.dataset.param = "active";
        document.querySelectorAll(".to-code-input, .to-scan-input").forEach(btn => btn.dataset.param = "active");
    }

    run() {
        new main().on("#code-input");
        this.init();
    }
}


class dataCtrl {
    constructor() {
        this.theData = {
            foto      : "driver.jpeg",
            name      : "Driver Name",
            nopol     : "DE 1234 AM",
            nolambung : "A 124",
            kendaraan : "Pick-up L300"
        };
        this.rx       = 0;
        this.bindElements();
        this.init();
    }
    scannerCtrl(data) {
        this.theData = {
            foto        : (data.foto) ? data.foto : "logo.png",
            name        : (data.name) ? data.name : "Undefined",
            nopol       : (data.nopol) ? data.nopol : "Undefined",
            nolambung   : (data.nolambung) ? data.nolambung : "Undefined",
            kendaraan   : (data.kendaraan) ? data.kendaraan : "Undefined"
        }
        this.writeData()
    }
    codeCtrl(data) {
        //console.log("DTX :", data)
        this.theData = {
            foto        : (data.foto) ? data.foto : "logo.png",
            name        : (data.NAMA) ? data.name : "Undefined",
            nopol       : (data.NOPOL) ? data.nopol : "Undefined",
            nolambung   : (data.NOLAMBUNG) ? data.nolambung : "Undefined",
            kendaraan   : (data.KENDARAAN) ? data.kendaraan : "Undefined"
        }
        this.writeData()
    }
    writeData() {
        const data = this.theData
        console.log("datax : " + JSON.stringify(data))
        this.nameOutput.textContent = data.name
        this.nopolOutput.textContent = data.nopol
        this.nolamOutput.textContent = data.nolambung
        this.kendOutput.textContent = data.kendaraan
        this.init()
    }
    bindElements() {
        this.formGroups     = document.querySelectorAll('.confirm-group');
        this.liters         = document.querySelectorAll(".form-liter");
        this.lanjutkan      = document.querySelector('#lanjutkan');
        this.afterBox       = document.querySelector('#after-box');
        this.formLiter      = document.querySelector('#form-liter');
        this.literClose     = document.querySelector('#liter-close');
        this.liter          = document.querySelector('#liter');
        this.literError     = document.querySelector("#liter-error");
        this.submit         = document.querySelector("#submit");
        this.resent         = document.querySelector("#resent");
        this.lanjutkanText  = document.querySelector("#lanjutkan-text");
        this.loaderBox      = document.querySelector(".loader-box");
        this.loaderText     = document.querySelector(".loader-text");
        this.success        = document.querySelector("#success");
        this.failed         = document.querySelector("#failed");
        this.toReport       = document.querySelector("#to-report");
        this.formReport     = document.querySelector("#form-report");
        this.report         = document.querySelector("#report");
        this.reportNote     = document.querySelector("#report-input");
        this.fotoOutput     = document.querySelector("#foto-output")
        this.nameOutput     = document.querySelector("#name-output")
        this.nopolOutput    = document.querySelector("#nopol-output")
        this.nolamOutput    = document.querySelector("#nolambung-output")
        this.kendOutput     = document.querySelector("#kendaraan-output")
    }
    init() {
        new main().on("#content")
        document.querySelector(".liters").onclick = () => this.liter.focus();

        this.formGroups.forEach(form => {
            const sx = form.querySelector('.sx');
            const tx = form.querySelector('.tx');

            sx.onclick = () => this.handleChoice(form, true, sx, tx);
            tx.onclick = () => this.handleChoice(form, false, sx, tx);
        });

        this.lanjutkan.addEventListener("click", () => this.handleLanjutkan());
        this.literClose.addEventListener("click", () => this.toggleLiterForm(false));
        this.liter.addEventListener("keyup", (e) => this.handleLiterInput());

        [this.submit, this.resent].forEach(btn => {
            btn.addEventListener("click", () => this.handleSubmit(btn.id));
        });

        this.toReport.addEventListener("click", () => this.showReportForm());
        this.report.addEventListener("click", () => this.sendReport());
    }
    handleChoice(form, isTrue, sx, tx) {
        form.dataset.value = isTrue ? "true" : "false";
        sx.parentElement.classList.remove("highlight");

        if (isTrue) {
            sx.querySelector('i').classList.add('clr-green', 'br-green');
            sx.classList.add('active');
            sx.classList.remove('inactive');
            tx.classList.add('inactive');
            tx.classList.remove('active');
        } else {
            tx.querySelector('i').classList.add('clr-orange', 'br-orange');
            tx.classList.add('active');
            tx.classList.remove('inactive');
            sx.classList.add('inactive');
            sx.classList.remove('active');
        }

        this.updateLanjutkanState();
    }
    updateLanjutkanState() {
        let allSelected = Array.from(this.formGroups).every(group => group.dataset.value !== "");
        if (allSelected) {
            this.lanjutkan.classList.remove("cancel");
            this.lanjutkanText.classList.add("dis-none");
        } else {
            this.lanjutkan.classList.add("cancel");
            this.lanjutkanText.classList.remove("dis-none");
        }
    }
    handleLanjutkan() {
        if (this.lanjutkan.classList.contains("cancel")) {
            this.formGroups.forEach(group => {
                if (group.dataset.value === "") group.classList.add("highlight");
            });
            this.lanjutkanText.classList.add("active");
            this.lanjutkanText.textContent = "Pastikan semua pilihan terpilih";
        } else {
            this.afterBox.classList.remove('dis-none');
            this.formLiter.classList.remove('dis-none');
        }
    }
    toggleLiterForm(show) {
        this.afterBox.classList.toggle('dis-none', !show);
        this.formLiter.classList.toggle('dis-none', !show);
    }
    handleLiterInput() {
        if (this.liter.value == 0) this.liter.value = "";
        if (this.liter.value === "") {
            this.literError.textContent = "Masukan angka.";
        } else if (this.liter.value.length >= 1) {
            this.literError.textContent = "Masukan jumlah liter.";
        }
        this.liter.value = this.liter.value.replace(/[^0-9]/g, '');
        if (this.liter.value.length > 3) this.liter.value = this.liter.value.substring(0, 3);
    }
    handleSubmit(buttonId) {
        console.log("click", this.liter.value);
        if (buttonId === "resent") this.rx += 1;
        if (this.rx >= 2) this.toReport.classList.remove("dis-none");
        if (this.liter.value >= 1) {
            this.addTrxData(this.getValue());
        } else {
            this.literError.textContent = "Masukan jumlah liter.";
            this.literError.classList.add("clr-red");
        }
    }
    showReportForm() {
        this.liters.forEach(literx => literx.classList.add("dis-none"));
        this.formReport.classList.remove("dis-none");
    }
    async sendReport() {
        if (this.reportNote.value === "") return;

        this.liters.forEach(literx => literx.classList.add("dis-none"));
        this.loaderBox.classList.remove("dis-none");
        this.updateLoader("Form check", 1000);
        this.updateLoader("Collecting data", 2000);
        this.updateLoader("Sending request", 3000);

        const formated = this.getDateTime();
        await fetch("https://api.fonnte.com/send", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "FRKfzmnGdc9PzVE8Pc_1"
            },
            body: JSON.stringify({
                target: "081354741823",
                message: `Error report : ${formated}\n${this.theData.nolambung} : ${this.reportNote.value}`,
                typing: true
            })
        });
    }
    updateLoader(text, delay) {
        setTimeout(() => {
            this.loaderText.textContent = text;
        }, delay);
    }
    getDateTime() {
        const pad = n => n.toString().padStart(2, '0');
        const now = new Date();
        return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    }
    getValue() {
        return {
            col2: this.getDateTime(),
            col3: (this.konfirmasi().countFalse.length >= 1) ? "false" : "true",
            col4: this.note(),
            col5: document.querySelector("#foto").dataset.value,
            col6: document.querySelector("#nama").dataset.value + " - " + this.theData.name,
            col7: document.querySelector("#nopol").dataset.value + " - " + this.theData.nopol,
            col8: document.querySelector("#nolambung").dataset.value + " - " + this.theData.nolambung,
            col9: document.querySelector("#kendaraan").dataset.value + " - " + this.theData.kendaraan,
            col10: this.liter.value,
            col11: "unknown"
        };
    }
    konfirmasi() {
        let countFalse = [], countTrue = [];
        this.formGroups.forEach(group => {
            if (group.dataset.value === "true") countTrue.push(group.id);
            else countFalse.push(group.id);
        });
        return { countFalse, countTrue };
    }
    note() {
        const { countFalse, countTrue } = this.konfirmasi();
        if (countFalse.length === 0) return "All true";
        if (countTrue.length === 0) return "All false";

        const falseText = countFalse.join(', ');
        const trueText = countTrue.join(', ');
        return `${countTrue.length} True (${trueText}) - ${countFalse.length} False (${falseText})`;
    }
    async addTrxData(data) {
        this.loaderBox.classList.remove("dis-none");
        this.liters.forEach(literx => literx.classList.add("dis-none"));

        this.updateLoader("Form check", 1000);
        this.updateLoader("Collecting data", 2000);
        this.updateLoader("Sending request", 3000);

        const json = await new main().myPost({
            link: new main().link,
            data: {
                type: "addData",
                data: data
            }
        });
        if (!json || !json.confirm) this.afterRespon("#failed");
        else this.afterRespon("#success");
    }
    afterRespon(selector) {
        this.liters.forEach(literx => literx.classList.add("dis-none"));
        document.querySelector(selector).classList.remove("dis-none");
        this.loaderBox.classList.add("dis-none");
        this.loaderText.textContent = " . . . ";
    }
}


/*
const ts = async () => {
    const res = await fetch("https://script.google.com/macros/s/AKfycby-C5OLjRmlcSMypMHdwio2Ap2Ppa4lMre1MjM_2Yao4hZmq0ssN5jdiWPDlm3AZss7cg/exec?type=get-driver&code=X-212")
    const jsn = await res.json()
    console.log(jsn)
}
//ts()
//https://script.google.com/macros/s/AKfycby-C5OLjRmlcSMypMHdwio2Ap2Ppa4lMre1MjM_2Yao4hZmq0ssN5jdiWPDlm3AZss7cg/exec?type=get-driver&code=X-212
*/


const ftx = async () => {
        const proxy = "https://bbmctrl.dlhpambon2025.workers.dev?url=" + encodeURIComponent(new main().appScript);
        const response = await fetch(proxy, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                type : "getDriver",
                code : "X-212"
            })
        });
        const res = await response.json();
        console.log(res)
    }
ftx()




