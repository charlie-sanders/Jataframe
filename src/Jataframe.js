const operators = {
    '==': (a, b) => a == b,
    '!=': (a, b) => a != b,
    '>': (a, b) => a > b,
    '>=': (a, b) => a >= b,
    '<': (a, b) => a < b,
    '<=': (a, b) => a <= b,
    'in': (a, b) => b.includes(a),

}
const handlers = {
    get: (target, prop, receiver) => {
        if (prop in target && prop[0] !== '_') {
            if (typeof target[prop] === 'function') {
                return target[prop].bind(target);
            } else {
                return target[prop];
            }
        } else {
            return target._column(prop);
        }
    }
}

class Jataframe {

    constructor(rows) {
        if (!Array.isArray(rows)) {
            throw new Error('Jataframe must be initialized with an array of objects');
        }
        this.data = rows;
        return new Proxy(this, handlers);
    }


    get columns() {
        return Object.keys(this.data[0]);
    }

    get length() {
        return this.data.length;
    }

    sum(column) {
        return this.data.reduce((acc, row) => acc + row[column], 0);
    }

    mean(column) {
        return this.sum(column) / this.length;
    }

    head(n) {
        return this.data.slice(0, n);
    }

    tail(n) {
        return this.data.slice(-n);
    }


    median(column) {
        const sorted = this._column(column).sort((a, b) => a - b);
        const middle = Math.floor(sorted.length / 2);
        if (sorted.length % 2 === 0) {
            return (sorted[middle - 1] + sorted[middle]) / 2;
        }
        return sorted[middle];
    }

    /**
     * Returns a new Jataframe with the std deviation of each column
     * @param column
     * @return {number}
     */
    std(column) {
        const mean = this.mean(column);
        return Math.sqrt(this.data.reduce((acc, row) => acc + Math.pow(row[column] - mean, 2), 0) / this.length);
    }

    describe(column) {
        return {
            'mean': this.mean(column),
            'std': this.std(column),
            'median': this.median(column),
            'mode': this.mode(column),
            'min': this.min(column),
            'max': this.max(column),
            'count': this.length,
        }
    }

    mode(column) {
        const counts = {};
        this._column(column).forEach((x) => {
            counts[x] = (counts[x] || 0) + 1;
        });
        return Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);
    }

    min(key) {
        return Math.min(...this._column(key));
    }

    max(key) {
        return Math.max(...this._column(key));
    }

    groupBy(key) {
        const groups = {};
        this.data.forEach(row => {
            const group = row[key];
            if (!groups[group]) {
                groups[group] = [];
            }
            groups[group].push(row);
        });
        for (let group in groups) {
            groups[group] = new Jataframe(groups[group]);
        }
        return groups;
    }

    aggregateBy(key, aggs) {

        const groups = this.groupBy(key, aggs);
        const result = [];
        for (let group in groups) {
            const template = {'group': group};

            for (let agg_name in aggs) {
                const agg_kv = aggs[agg_name];
                // console.log('agg_kv', agg_kv);
                // console.log('agg_name', agg_name);
                // console.log('group', group);
                const key = Object.keys(agg_kv)[0];
                const agg_func = agg_kv[key];
                // console.log('key', key);
                // console.log('agg_func', agg_func);

                template['row_count'] = groups[group][key].length;
                template[agg_name] = agg_func(groups[group][key]);
            }
            result.push(template);
        }
        return new Jataframe(result);

    }

    _column(key) {
        return this.data.map(row => row[key]).filter(x => x !== undefined);
    }

    query(key, operator, value) {


        return new Jataframe(this.data.filter(row => operators[operator](row[key], value)));
    }

    filter(fn) {
        return new Jataframe(this.data.filter(fn));
    }

    unique(column) {
        return [...new Set(this._column(column))];
    }

    print() {
        console.table(this.data);
    }

    /**
     * Timestamp slice, assuming the first column has timestamp data
     * @param column_or_index
     * @param _start
     * @param _end
     * @return {*}
     */
    ts_slice(column_or_index, _start, _end) {
        let start = _start, end = _end;
        if (_start instanceof Date) {
            start = _start.getTime();
        }
        if (_end instanceof Date) {
            end = _end.getTime();
        }

        return new Jataframe(this.data.filter(row => row[column_or_index] >= start && row[column_or_index] <= end));

    }

    slice(_start, _end) {
        return new Jataframe(this.data.slice(_start, _end));
    }

    sort(_keys, _order = 'ascending', _coerceFunc = null) {
        let order = _order === 'ascending' ? 'asc' : 'desc';
        let coerceFunc = _coerceFunc || ((x) => x);
        // let keys = _.isArray(_keys) ? _keys : [_keys];
        // return new Jataframe(_.orderBy(this.data, keys, [order]));

        return new Jataframe(this.data.sort((a, b) => {
            if (coerceFunc(a[_keys]) < coerceFunc(b[_keys])) {
                return order === 'asc' ? -1 : 1;
            }
            if (coerceFunc(a[_keys]) > coerceFunc(b[_keys])) {
                return order === 'asc' ? 1 : -1;
            }
            return 0;
        }));
    }

    toJSON() {
        return this.data;
    }

}


Object.defineProperty(Jataframe, 'gt', {
    value: '>',
    writable: false,
    enumerable: false,
    configurable: false
});
Object.defineProperty(Jataframe, 'lt', {
    value: '<',
    writable: false,
    enumerable: false,
    configurable: false
});
Object.defineProperty(Jataframe, 'gte', {
    value: '>=',
    writable: false,
    enumerable: false,
    configurable: false
});

Object.defineProperty(Jataframe, 'lte', {
    value: '<=',
    writable: false,
    enumerable: false,
    configurable: false
});

Object.defineProperty(Jataframe, 'eq', {
    value: '==',
    writable: false,
    enumerable: false,
    configurable: false
});

Object.defineProperty(Jataframe, 'neq', {
    value: '!=',
    writable: false,
    enumerable: false,
    configurable: false
});

Object.defineProperty(Jataframe, 'in', {
    value: 'in',
    writable: false,
    enumerable: false,
    configurable: false
});
Object.defineProperty(Jataframe, 'sum', {
    value: function (arr) {
        return arr.reduce((a, b) => (a ? a : 0) + (b ? b : 0), 0)
    },
    writable: false,
    enumerable: false,
    configurable: false
});

Object.defineProperty(Jataframe, 'mean', {
    value: function (arr) {
        return arr.reduce((a, b) => a + b, 0) / arr.length
    },
    writable: false,
    enumerable: false,
    configurable: false
});

Object.defineProperty(Jataframe, 'median', {
    value: function (arr) {
        const mid = Math.floor(arr.length / 2),
            nums = [...arr].sort((a, b) => a - b);
        return arr.length % 2 !== 0 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
    }
});

Object.defineProperty(Jataframe, 'min', {
    value: function (arr) {
        return Math.min(...arr)
    },
    writable: false,
    enumerable: false,
    configurable: false
});

Object.defineProperty(Jataframe, 'max', {
    value: function (arr) {
        return Math.max(...arr)
    },
    writable: false,
    enumerable: false,
    configurable: false
});


module.exports = Jataframe;
