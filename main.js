const ROWS = 8;

const REFRESH_INTERVAL_MS = 5;

const PIXEL_TIMEOUT = 3000;
const PIXEL_SIZE = 35;
const PIXEL_GUTTER = 5;

const BUCKET_SECONDS = 5;

class App {
	constructor() {
		this.colors = new Colors();
		this.interval = null;

		this.startButton = new Button("start", this.start.bind(this));
		this.stopButton = new Button("stop", this.stop.bind(this));

		this.resizeButton = new Button("resize", this.resize.bind(this));
		this.resizeButton.hide();

		const c = this.getColumns();
		this.columns = c;
		this.grid = new Grid(c);
		this.graph = new Graph(c);
	}

	stateChange() {
		if (document.hidden) {
			this.stop();
		} else {
			this.start();
		}
	}

	resized() {
		this.resizeButton.show();
	}

	resize() {
		const c = this.getColumns();
		this.columns = c;
		this.grid.resize(c);
		this.graph.resize(c);
		this.resizeButton.hide();
	}

	start() {
		this.interval = setInterval(() => {
			this.load();
		}, REFRESH_INTERVAL_MS);
		this.on = true;
		this.startButton.select();
		this.stopButton.deselect();
	}	

	stop() {
		clearInterval(this.interval);
		this.on = false;
		this.startButton.deselect();
		this.stopButton.select();
	}

	req() {
		const colors = Object.keys(this.colors.available) || [];
		if (colors.length == 0) {
            return "[]"
        }
        let values = []
        colors.forEach(color => {
            values.push(this.colors.available[color].values())
        })
		return JSON.stringify(values);
	}

	load(body) {
	    fetch('./color', {
	        method: "POST",
	        body: this.req(),
	    })
	    .then(function(res) {
	       return res.json().then(color => ({ color, res }))
	    }).then((function(res) {
	    	const {color, status} = res;
	    	this.colors.add(color);
	        this.grid.light(this.randCoord(), color);
	        this.graph.record(color);
	    }).bind(this));
	}

	randCoord() {
		const row = Math.round(Math.random() * ROWS);
		const col = Math.round(Math.random() * this.columns);
		return [row, col];
	}

	getColumns() {
		return Math.round(window.innerWidth / (PIXEL_SIZE + PIXEL_GUTTER)) - 2;
	}
}

class Button {
	constructor(suffix, onClick) {
		this.container = document.querySelector(`.button--${suffix}`);
		this.container.addEventListener("click", onClick);
	}

	select() {
		this.container.classList.add("button--selected");
	}

	deselect() {
		this.container.classList.remove("button--selected");
	}

	hide() {
		this.container.style.visibility = "hidden";
	}

	show() {
		this.container.style.visibility = "visible";
	}
}

class Slider {
	constructor(name, unitLabel, onChange) {
		this.slider = document.getElementById(name);
		this.label = document.getElementById(`${name}-label`);
		this.unit = unitLabel;
		this.update();
		this.onChange = onChange.bind(this);
		this.slider.oninput = this.update.bind(this);
	}

	format(val) {
		return `${Math.round(val * 10) / 10 || 0}${this.unit}`;
	}

	update() {
		this.value = this.slider.value;
		this.onChange && this.onChange(this.value);
		this.label.innerHTML = this.format(this.value);
	}

	setValue(val) {
		this.value = val || 0;
		this.label.innerHTML = this.format(this.value);
		this.slider.value = this.value;
	}
}

class Colors {
	constructor() {
		this.available = {};
		this.container = document.getElementById("colors");
		this.selected = null;

    	this.latencySlider = new Slider("latency", "s", l => {
    		if (this.selected) {
    			this.available[this.selected].latency = l;
    		}
    	});
		this.errorSlider = new Slider("error", "%", e => {
    		if (this.selected) {
    			this.available[this.selected].error = e;
    		}
    	});
	}

	add(color) {
		if (!this.available[color]) {
			const c = new Color(color, () => this.select(color));
	    	this.container.appendChild(c.container);
	    	this.available[color] = c;
	    	this.select(color);
		}
	}

	select(color) {
		if (this.selected !== color) {
			if (this.selected) {
				this.available[this.selected].container.classList.remove('colors__selected');
			}
			this.selected = color;
			this.available[color].container.classList.add('colors__selected');
			this.latencySlider.setValue(this.available[color].latency);
			this.errorSlider.setValue(this.available[color].error);
		}
	}

	list() {
		return Object.keys(this.available);
	}
}

class Color {
	constructor(name, onClick) {
		this.name = name;
		const el = document.createElement("div");
    	el.classList.add(`colors__${name}`);
    	el.addEventListener("click", onClick.bind(this));
    	this.container = el;
		this.latency = 0;
		this.error = 0;
	}

	values() {
		return {
	        "color": this.name,
	        "return500": parseInt(this.error, 10),
	        "delayPercent": 100,
	        "delayLength": parseInt(this.latency, 10)
	    }
	}
}

class Grid {
	constructor(c) {
		this.container = document.getElementById("grid");
		this.resize(c);
	}

	resize(col) {
		this.container.innerHTML = null;
		this.pixels = [];
		for (const r of Array(ROWS).keys()) {
			this.pixels.push([]);
			const row = document.createElement("div");
			row.className = "row";
			row.id = `row-${r}`
			for (const c of Array(col).keys()) {
				const px = new Pixel(r, c);
				this.pixels[r][c] = px;
				row.appendChild(px.container);
			}
			this.container.appendChild(row);
		}		
	}

	light(coord, color) {
		let [row, col] = coord;
		let px = false;
		if (this.pixels[row]) {
			const px = this.pixels[row][col];
			if (px) {
				px.light(color, PIXEL_TIMEOUT);
			}
		}
	}
}

class Pixel {
	constructor(row, col) {
		this.row = row;
		this.col = col;
		const container = document.createElement("div");
		container.className = "pixel";
		container.id = `pixel--${row},${col}`;
		this.container = container;
	}

	genClassName(color) {
		return `pixel__${color || 'on'}`;
	}

	dim(color) {
		this.container.classList.remove(this.genClassName(color));
	}

	light(color, ms) {
		setTimeout(() => this.dim(color), ms);
		const className = this.genClassName(color);
		this.container.className = '';
		this.container.classList.add('pixel');
		this.container.classList.add(className);
	}
}

class Graph {
	constructor(c) {
		this.container = document.getElementById("graph");
		this.cur = 0;
		this.buckets = [];
		this.resize(c);
	}

	record(color) {
		if (this.cur >= this.buckets.length) {
			this.buckets.shift();
			this.buckets.push(new Bucket());
			this.cur--;
		}
		const curBucket = this.buckets[this.cur];
		if (!curBucket) {
			return;
		}
		const el = curBucket.drip(color);
		if (el) {
			this.cur += 1;
			this.container.removeChild(this.container.lastChild);
			this.container.prepend(el);
		}
	} 

	resize(col) {
		this.buckets = [];
		this.container.innerHTML = null;
		for (const c of Array(col).keys()) {
			this.buckets.push(new Bucket());

			const bar = document.createElement("div");
			bar.classList.add('bar');
			this.container.appendChild(bar);
		}
	}
}

class Bucket {
	constructor() {
		const reqPerSecond = 1000 / REFRESH_INTERVAL_MS;
		this.capacity = BUCKET_SECONDS * reqPerSecond;
		this.level = 0;
		this.amounts = {};
	}

	drip(color) {
		if (!this.amounts[color]) {
			this.amounts[color] = 0;
		}
		this.amounts[color] += 1;
		this.level += 1;
		if (this.level >= this.capacity) {
			return this.full();
		}
		return false;
	}

	full() {
		const el = document.createElement("div");
		el.classList.add('bar');
		for (const c of Object.keys(this.amounts).sort((a, b) => a > b)) {
			const fill = document.createElement("div");
			fill.classList.add('bar__fill');
			fill.classList.add(`graph__${c}`);
			fill.style.height = `${100 * this.amounts[c]/this.capacity}%`;
			el.appendChild(fill);
		}
		return el;
	}
}

const app = new App();
app.start();
window.addEventListener("resize", app.resized.bind(app));
document.addEventListener("visibilitychange", app.stateChange.bind(app));