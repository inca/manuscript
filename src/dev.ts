export function clientSideDevScript() {

    connectDev();

    function connectDev() {
        const ws = new WebSocket(`ws://${location.host}`);

        ws.onclose = function() {
            setTimeout(connectDev, 500);
        };

        ws.onopen = function() {
            console.info('Connected to dev server');
        };

        ws.onmessage = function(ev: MessageEvent) {
            const payload = JSON.parse(ev.data);
            switch (payload.type) {
                case 'cssChanged':
                    return onCssChanged(payload.cssFile);
                case 'templateChanged':
                case 'reloadNeeded':
                    return location.reload();
            }
        };

        ws.onerror = function(ev) {
            ev.preventDefault();
            ev.stopPropagation();
            return false;
        };

    }

    function onCssChanged(file: string) {
        const link = document.querySelector(`link[rel="stylesheet"][href^="/${file}"]`);
        if (link) {
            const newHref = link.getAttribute('href')?.replace(/\?.*/, '') + '?' + Date.now();
            link.setAttribute('href', newHref);
        }
    }

}
