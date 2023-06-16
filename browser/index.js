let cloud;
let utils;
let transformPoint;
let symbols;
let mapObj;
let clicktimer;
let active = true;
let currentZoom;
let modalHelp;
let modalElHelp;
const cookie = require('js-cookie');
const urlparser = require('../../../browser/modules/urlparser');
const config = require('../../../config/config.js');

const SWITCH_LEVEL = 19;

let setBaseLayer;
module.exports = {

    /**
     *
     * @param o
     * @returns {exports}
     */
    set: function (o) {
        cloud = o.cloud;
        utils = o.utils;
        setBaseLayer = o.setBaseLayer;
        transformPoint = o.transformPoint;
        symbols = o.extensions.symbols.index;
        return this;
    },

    /**
     *
     */
    init: function () {
        const switchBaseLayer = (z, init = false) => {
            if (z > SWITCH_LEVEL && (currentZoom <= SWITCH_LEVEL || init)) {
                // setBaseLayer.init('geodanmark_2020_12_5cm');
            }

            if (z <= SWITCH_LEVEL && (currentZoom > SWITCH_LEVEL || init)) {
                // setBaseLayer.init('osm');
            }
        }

        const switchSymbolsCover = (z) => {
            let opacity = '100%';
            let pointerEvents = 'none';
            let display = 'inline';
            if (z > SWITCH_LEVEL) {
                opacity = '100%'
                pointerEvents = 'auto';
                display = 'none';
            } else {
                opacity = '10%'
                pointerEvents = 'none';
                display = 'inline';
            }
            const poll = () => {
                const e = $('.symbols-cover');
                const t = $('.symbols-cover-text');

                if (e.length > 0 && t.length > 0) {
                    e.css('opacity', opacity);
                    e.css('pointer-events', pointerEvents);
                    t.css('display', display);
                } else {
                    setTimeout(() => {
                        poll();
                    }, 50)
                }
            }
            poll();
        }

        $('#vidi-symbols-store').on('click', () => {
            symbols.store('f').then((e) => {
                    symbols.lock();
                    $('#vidi-symbols-store').attr('disabled', true);
                    $('#aau-reset').attr('disabled', true);
                    $('#aau-help').attr('disabled', true);
                    window.parent.postMessage({type: "doneCallback", symbolState: symbols.getState().symbolState}, "*");
                },
                (e) => {
                    console.log("Error", e);
                    alert("Noget gik galt - prøv igen");
                }
            )
        });
        $('#confirm1').click((e) => {
            const c = countSymbols();
            if (c < 2) {
                alert(`Du skal placere en pil`);
                return;
            }
            if (c > 2) {
                alert(`Du må kun placere en pil. Slet venligst en eller flere`);
                return;
            }

            if (config?.extensionConfig?.symbols?.files?.length === 2) {
                $('#confirm1').hide();
                $('#confirm2').show();
            } else {
                $('#confirm1').hide();
                $('#confirm2').show();
                const someTabTriggerEl = document.querySelector('#symbol-tab-2');
                const tab = new bootstrap.Tab(someTabTriggerEl);
                tab.show();
            }
            $('.symbols-delete').hide();
            $('#aau-step-modal').find('button').html('Næste');
            symbols.store('i2');
        })


        $('#confirm2').click(() => {
            const c = countSymbols();
            if (c < 1) {
                alert(`Du skal placere en pil`);
                return;
            }
            // if (c > 4) {
            //     alert(`Du må kun placere max to pile. Slet venligst en eller flere`);
            //     return;
            // }
            $('#confirm2').show();
            $('.symbols-delete').hide();
        })
        $('#aau-help').click(() => {
            modalElHelp.show()
        })
        $('#aau-reset').click(() => {
            if (confirm("Er du sikker på, at du vil starte forfra med registrering i kortet?")) {
                location.hash = '';
                location.reload();
            }
        })

        const countSymbols = () => {
            const state = symbols.getState();
            return Object.keys(state.symbolState).length;
        }

        modalHelp = document.getElementById('aau-help-modal');
        modalElHelp = new bootstrap.Modal(modalHelp);
        if (config.extensionConfig.symbols.options?.flag === 1) {
            $('#aau-step-modal-body').html(`På dette kort skal du markere, hvor hændelsen skete. Følg vejledningen nederst på siden. Klik næste, når du er klar til at begynde.`);
        } else if (config.extensionConfig.symbols.options?.flag === 2) {
            $('#aau-step-modal-body').html(`På dette kort skal du markere, hvor hændelsen skete, og hvad der skete. Følg vejledningen nederst på siden. Klik næste, når du er klar til at begynde.`);
        } else {
            $('#aau-step-modal-body').html(`På dette kort skal du markere, hvor hændelsen skete, hvorfra du kom, og hvorfra din modpart kom. Følg vejledningen nederst på siden. Klik næste, når du er klar til at begynde.`);
        }
        const modalEl = document.getElementById('aau-step-modal')
        const modal = new bootstrap.Modal(modalEl)
        modal.show()

        // Override browser and user id
        window._browserId = urlparser.urlVars?.userid || 'Ikke registreret';
        window._userId = urlparser.urlVars?.gr || 'Ikke registreret';
        // Try to set props
        try {
            if (urlparser.urlVars?.props) {
                window._props = JSON.parse(urlparser.urlVars.props);
            }
        } catch (e) {
            console.info("Error in props json - setting it to null");
            window._props =  null;
        }

        /**
         *
         * Native Leaflet object
         */
        mapObj = cloud.get().map;
        mapObj.on('dblclick', function () {
            clicktimer = undefined;
        });
        mapObj.on('click', function (e) {
            let event = new geocloud.clickEvent(e, cloud);
            if (clicktimer) {
                clearTimeout(clicktimer);
            } else {
                if (active === false) {
                    return;
                }
                if (currentZoom <= SWITCH_LEVEL) {
                    alert('Du skal zoome tættere på, inden du kan markere, hvor det skete. Zoom ind, indtil kortet skifter til et luftfoto.');
                    return;
                }
                clicktimer = setTimeout(function () {
                    let coords = event.getCoordinate(), p, url;
                    p = utils.transform("EPSG:3857", "EPSG:4326", coords);
                    clicktimer = undefined;

                    let file = 'red_dot.svg';
                    let innerHtml = $(`[data-file='${file}']`).clone().html();
                    let id = symbols.createId();
                    symbols.createSymbol(innerHtml, id, [p.y, p.x], 0, 0, mapObj.getZoom(), file);
                    symbols.store('i1');
                    active = false;
                    $('.symbols-cover-text').css('opacity', '100%');
                    if (currentZoom <= SWITCH_LEVEL) $('.symbols-cover-text').show();
                    if (config?.extensionConfig?.symbols?.files?.length === 1) {
                        $('#confirm2').show();
                    } else if (config?.extensionConfig?.symbols?.files?.length === 2) {
                        $('#confirm2').show();
                        const someTabTriggerEl = document.querySelector('#symbol-tab-1');
                        const tab = new bootstrap.Tab(someTabTriggerEl);
                        tab.show();

                    } else {
                        $('#confirm1').show();
                        const someTabTriggerEl = document.querySelector('#symbol-tab-1');
                        const tab = new bootstrap.Tab(someTabTriggerEl);
                        tab.show();
                    }

                }, 250);
            }
        });
        mapObj.on('zoomend', () => {
            const z = mapObj.getZoom();
            switchBaseLayer(z);
            switchSymbolsCover(z);
            currentZoom = z;
        });
        const z = mapObj.getZoom();
        currentZoom = z;
        // switchBaseLayer(z, true);
        switchSymbolsCover(z);




    }

};
