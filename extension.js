import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import St from 'gi://St';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

const MyPanelButton = GObject.registerClass(
class MyPanelButton extends PanelMenu.Button {
    _init() {
        super._init(0.0, 'Crypto Price Button', false);

        this.buttonText = new St.Label({
            text: 'BTC: Загрузка | ETH: Загрузка',
            y_align: Clutter.ActorAlign.CENTER
        });
        this.add_child(this.buttonText);
    }

    _updatePrice() {
        // Запрос для BTC (id=1) и ETH (id=1027) одновременно
        const url = 'https://pro-api.coinmarketcap.com/public-api/v1/simple/price?ids=1,1027&convert=USD';
        
        try {
            const proc = Gio.Subprocess.new(
                ['curl', '-sL', '-m', '10', url],
                Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
            );

            proc.communicate_utf8_async(null, null, (obj, res) => {
                try {
                    const [success, stdout, stderr] = obj.communicate_utf8_finish(res);
                    
                    if (success && stdout) {
                        const responseText = stdout.trim();

                        if (responseText.startsWith('<')) {
                            this.buttonText.set_text('BTC: Ошибка HTTP | ETH: Ошибка HTTP');
                            return;
                        }

                        const resultJson = JSON.parse(responseText);
                        
                        // Ожидаем массив data с двумя элементами (порядок соответствует ids)
                        if (resultJson && resultJson.data && Array.isArray(resultJson.data) && resultJson.data.length >= 2) {
                            const btcData = resultJson.data[0]; // первый — BTC
                            const ethData = resultJson.data[1]; // второй — ETH
                            
                            let btcPrice = 'Н/Д';
                            let ethPrice = 'Н/Д';
                            
                            if (btcData && btcData.price !== undefined) {
                                const price = parseFloat(btcData.price);
                                if (!isNaN(price)) {
                                    btcPrice = `$${price.toFixed(2)}`;
                                }
                            }
                            if (ethData && ethData.price !== undefined) {
                                const price = parseFloat(ethData.price);
                                if (!isNaN(price)) {
                                    ethPrice = `$${price.toFixed(2)}`;
                                }
                            }
                            
                            this.buttonText.set_text(`BTC: ${btcPrice} | ETH: ${ethPrice}`);
                        } else {
                            this.buttonText.set_text('BTC: Ошибка формата | ETH: Ошибка формата');
                        }
                    } else {
                        this.buttonText.set_text('BTC: Ошибка сети | ETH: Ошибка сети');
                    }
                } catch (err) {
                    this.buttonText.set_text('BTC: Ошибка разбора | ETH: Ошибка разбора');
                }
            });
        } catch (e) {
            this.buttonText.set_text('BTC: Ошибка процесса | ETH: Ошибка процесса');
        }
    }
});

export default class EthPriceExtension extends Extension {
    enable() {
        this._indicator = new MyPanelButton();
        Main.panel.addToStatusArea('eth-price-indicator', this._indicator, 1, 'right');
        
        this._indicator._updatePrice();

        this._timeoutId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 60, () => {
            if (this._indicator) {
                this._indicator._updatePrice();
            }
            return GLib.SOURCE_CONTINUE;
        });
    }

    disable() {
        if (this._timeoutId) {
            GLib.Source.remove(this._timeoutId);
            this._timeoutId = null;
        }
        if (this._indicator) {
            this._indicator.destroy();
            this._indicator = null;
        }
    }
}
