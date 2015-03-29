(function($) {
"use strict";


function Sortable(el, options) {
    //TODO: drag handle
    var self = this,
        $sortable = $(el),
        container_type = $sortable[0].nodeName,
        node_type = (container_type == 'OL' || container_type == 'UL') ? 'LI' : 'DIV',
        defaults = {
            //options
            container: container_type,
            container_type: container_type,
            nodes: node_type,
            nodes_type: node_type,
            placeholder_class: null,
            auto_container_class: 'sortable_container',
            autocreate: false,
            group: false,
            scroll: false,
            //callbacks
            update: null
        };

    self.$sortable = $sortable.data('sortable', self);
    self.options = $.extend({}, defaults, options);

    self.init();
}

Sortable.prototype.invoke = function(command) {
    var self = this;
    if (command === 'destroy') {
        return self.destroy();
    } else if (command === 'serialize') {
        return self.serialize(self.$sortable);
    }
};

Sortable.prototype.init = function() {
    var self = this;

    $('html').unselectable();

    self.$sortable
    .addClass('sortable')
    .on('destroy.sortable', function() {
        self.destroy();
    });

    self.find_nodes().each(function(ix, node) {
        self.init_node(node);
    });
};

Sortable.prototype.destroy = function() {
    var self = this;

    $('html').unselectable('destroy');

    self.$sortable
    .removeClass('sortable')
    .off('.sortable');

    self.find_nodes().each(function(ix, node) {
        self.destroy_node(node);
    });
};

Sortable.prototype.init_node = function(node) {
    var self = this,
        $node = $(node),
        $clone,
        $placeholder,
        origin;

    function find_insert_point(offset) {
        var containers,
            best;

        if (!offset) {
            return;
        }

        containers = self.$sortable
        .add(self.$sortable.find(self.options.container))
        .not($node.find(self.options.container))
        .not($clone.find(self.options.container))
        .not(self.find_nodes());

        $placeholder.hide();
        containers.each(function(ix, container) {
            var $trailing = $(self.create_placeholder()).appendTo(container),
                $children = $(container).children(self.options.nodes).not('.sortable_clone'),
                $candidate,
                n,
                dist;

            for (n = 0; n < $children.length; n++) {
                $candidate = $children.eq(n);
                dist = self.square_dist($candidate.offset(), offset);
                if (!best || best.dist > dist) {
                    best = {container: container, before: $candidate[0], dist: dist};
                }
            }

            $trailing.remove();
        });
        $placeholder.show();

        return best;
    }

    function insert($element, best) {
        var $container = $(best.container);
        if (best.before && best.before.closest('html')) {
            $element.insertBefore(best.before);
        } else {
            $element.appendTo($container);
        }
        return this;
    };




    $node.dragaware($.extend({}, self.options, {
        /**
         * drag start - create clone and placeholder, keep drag start origin.
         */
        dragstart: function(evt) {
            $clone = $node.clone()
                          .removeAttr('id')
                          .addClass('sortable_clone')
                          .insertAfter($node)
                          .offset($node.offset());
            $placeholder = self.create_placeholder()
                               .css({height: $node.outerHeight(), width: $node.outerWidth()})
                               .insertAfter($node);
            $node.hide();

            origin = new PositionHelper($clone.offset());

            if (self.options.autocreate) {
                self.find_nodes().filter(function(ix, el) {
                    return $(el).find(self.options.container).length == 0;
                }).append('<' + self.options.container_type + ' class="' + self.options.auto_container_class + '"/>');
            }
        },

        /**
         * drag - reposition clone, check for best insert position, move placeholder in dom accordingly.
         */
        drag: function(evt, pos) {
            var offset = origin.absolutize(pos),
                best = find_insert_point(offset);

            $clone.offset(offset);
            insert($placeholder, best);
        },

        /**
         * drag stop - clean up.
         */
        dragstop: function(evt, pos) {
            var offset = origin.absolutize(pos),
                best = find_insert_point(offset);

            if (best) {
                insert($node, best);
            }
            $node.show();

            if ($clone) {
                $clone.remove();
            }
            if ($placeholder) {
                $placeholder.remove();
            }
            $clone = null;
            $placeholder = null;

            if (best && self.options.update) {
                self.options.update.call(self.$sortable, evt, self);
            }
            self.$sortable.trigger('update');
        }
    }));
};

Sortable.prototype.destroy_node = function(node) {
    $(node).dragaware('destroy');
};

Sortable.prototype.serialize = function(container) {
    var self = this;
    return container.children(self.options.nodes).not(self.options.container).map(function(ix, el) {
        var $el = $(el),
            text = $el.clone().children().remove().end().text().trim(), //text only without children
            id = $el.attr('id'),
            node = {id: id || text};
        if ($el.find(self.options.nodes).length) {
            node.children = self.serialize($el.children(self.options.container));
        }
        return node;
    }).get();
};

Sortable.prototype.find_nodes = function() {
    var self = this;
    return self.$sortable.find(self.options.nodes).not(self.options.container);
};

Sortable.prototype.create_placeholder = function() {
    var self = this;
    return $('<' + self.options.nodes_type + '/>')
    .addClass('sortable_placeholder')
    .addClass(self.options.placeholder_class);
};

Sortable.prototype.square_dist = function(pos1, pos2) {
    return Math.pow(pos2.left - pos1.left, 2) + Math.pow(pos2.top - pos1.top, 2);
};




function Draggable(el, options) {
    var self = this,
        defaults = {
            //options
            handle: false,
            revert: false,
            placeholder: false,
            droptarget: false,
            container: false,
            scroll: false,
            //callbacks
            update: null,
            drop: null
        };

    self.$draggable = $(el).data('draggable', self);
    self.options = $.extend({}, defaults, options);

    self.init();
}

Draggable.prototype.init = function() {
    var self = this,
        $clone,
        origin;

    self.$draggable
    .addClass('draggable')
    .on('destroy.draggable', function() {
        self.destroy();
    });

    function check_droptarget(pos) {
        var $over;

        $('.hovering').removeClass('hovering');

        $clone.hide();
        $over = $(document.elementFromPoint(pos.clientX, pos.clientY)).closest(self.options.droptarget);
        $clone.show();

        if ($over.length) {
            $over.addClass('hovering');
            return $over;
        }
    }

    self.$draggable.dragaware($.extend({}, self.options, {
        /**
         * drag start - create clone, keep drag start origin.
         */
        dragstart: function(evt) {
            if (self.options.placeholder || self.options.revert) {
                $clone = self.create_clone('draggable_clone');
                if (!self.options.placeholder) {
                    self.$draggable.invisible();
                }
            } else {
                $clone = self.$draggable;
            }

            origin = new PositionHelper($clone.offset());
        },

        /**
         * drag - reposition clone.
         */
        drag: function(evt, pos) {
            var $droptarget = check_droptarget(pos);
            $clone.offset(origin.absolutize(pos));
        },

        /**
         * drag stop - clean up.
         */
        dragstop: function(evt, pos) {
            var $droptarget = check_droptarget(pos);

            if (self.options.revert) {
                $clone.remove();
                self.$draggable.visible();
            }

            $clone = null;

            if (self.options.update) {
                self.options.update.call(self.$draggable, evt, self);
            }

            self.$draggable.trigger('update');

            if ($droptarget) {
                if (self.options.drop) {
                    self.options.drop.call(self.$draggable, evt, $droptarget[0]);
                }
                $droptarget.trigger('drop', [self.$draggable]);
                $droptarget.removeClass('hovering');
            }
        }
    }));
};

Draggable.prototype.destroy = function() {
    var self = this;

    self.$draggable
    .dragaware('destroy')
    .removeClass('draggable')
    .off('.draggable');
};

Draggable.prototype.create_clone = function(classname) {
    var self = this;
    return self.$draggable
    .clone()
    .removeAttr('id')
    .addClass(classname)
    .appendTo(self.options.container || self.$draggable.parent())
    .offset(self.$draggable.offset());
};




function Droppable(el, options) {
    var self = this,
        defaults = {
            //options
            accept: false,
            //callbacks
            drop: null
        };

    self.$droppable = $(el).data('droppable', self);
    self.options = $.extend({}, defaults, options);

    self.init();
}

Droppable.prototype.init = function() {
    var self = this;

    self.$droppable
    .addClass('droppable')
    .on('drop', function(evt, $draggable) {
        console.log(arguments);
        if (self.options.accept && !$draggable.is(self.options.accept)) {
            return;
        }
        if (self.options.drop) {
            self.options.drop.call(self.$droppable, evt, $draggable);
        }
    })
    .on('destroy.droppable', function() {
        self.destroy();
    });
};

Droppable.prototype.destroy = function() {
    var self = this;

    self.$droppable
    .removeClass('droppable')
    .off('.droppable');
};




function Dragaware(el, options) {
    var $dragaware = $(el),
        origin = null,
        lastpos = null,
        defaults = {
            //options
            handle: null,
            scroll: false,
            scrollspeed: 15,
            scrolltimeout: 50,
            //callbacks
            dragstart: null,
            drag: null,
            dragstop: null
        },
        scrolltimeout;

    options = $.extend({}, defaults, options);

    /**
     * Returns the event position
     * dX, dY relative to drag start
     * pageX, pageY relative to document
     * clientX, clientY relative to browser window
     */
    function evtpos(evt) {
        evt = window.hasOwnProperty('event') ? window.event : evt;
        evt = evt && evt.hasOwnProperty('touches') ? evt.touches[0] : evt;

        return {
            pageX: evt.pageX,
            pageY: evt.pageY,
            clientX: evt.clientX,
            clientY: evt.clientY,
            dX: origin ? evt.pageX - origin.pageX : 0,
            dY: origin ? evt.pageY - origin.pageY : 0
        };
    }

    function autoscroll(pos) {
        //TODO: allow window scrolling
        //TODO: handle nested scroll containers
        var sp = $dragaware.scrollParent(),
            mouse = {x: pos.pageX, y: pos.pageY},
            offset = sp.offset(),
            scrollLeft = sp.scrollLeft(),
            scrollTop = sp.scrollTop(),
            width = sp.width(),
            height = sp.height();

        window.clearTimeout(scrolltimeout);

        if (scrollLeft > 0 && mouse.x < offset.left) {
            sp.scrollLeft(scrollLeft - options.scrollspeed);
        } else if (scrollLeft < sp.prop('scrollWidth') - width && mouse.x > offset.left + width) {
            sp.scrollLeft(scrollLeft + options.scrollspeed);
        } else if (scrollTop > 0 && mouse.y < offset.top) {
            sp.scrollTop(scrollTop - options.scrollspeed);
        } else if (scrollTop < sp.prop('scrollHeight') - height && mouse.y > offset.top + height) {
            sp.scrollTop(scrollTop + options.scrollspeed);
        } else {
            return; //so we don't set the next timeout
        }

        scrolltimeout = window.setTimeout(function() { autoscroll(pos); }, options.scrolltimeout);
    }

    function start(evt) {
        if (evt.type == 'touchstart' || evt.button == 0) {
            origin = lastpos = evtpos(evt);
            if (options.dragstart) {
                options.dragstart.call($dragaware, evt, lastpos);
            }

            $dragaware.addClass('dragging');
            $dragaware.trigger('dragstart');

            //late binding of event listeners
            $(document)
            .on('touchend.dragaware mouseup.dragaware click.dragaware', end)
            .on('touchmove.dragaware mousemove.dragaware', move);
            return false
        }
    }

    function move(evt) {
        lastpos = evtpos(evt);

        if (options.scroll) {
            autoscroll(lastpos);
        }
        if (options.drag) {
            options.drag.call($dragaware, evt, lastpos);
            return false;
        }
    }

    function end(evt) {
        window.clearTimeout(scrolltimeout);

        if (options.dragstop) {
            options.dragstop.call($dragaware, evt, lastpos);
        }

        origin = false;
        lastpos = false;

        $dragaware.removeClass('dragging');
        $dragaware.trigger('dragstop');

        //unbinding of event listeners
        $(document)
        .off('.dragaware');

        return false;
    }

    $dragaware
    .addClass('dragaware')
    .on('touchstart.dragaware mousedown.dragaware', options.handle, start);

    $dragaware.on('destroy.dragaware', function() {
        $dragaware
        .removeClass('dragaware')
        .off('.dragaware');
    });
}




function PositionHelper(origin) {
    this.origin = origin;
}
PositionHelper.prototype.absolutize = function(pos) {
    if (!pos) {
        return this.origin;
    }
    return {top: this.origin.top + pos.dY, left: this.origin.left + pos.dX};
};




// Plugin registration.


/**
 * Sortable plugin.
 */
$.fn.sortable = function(options) {
    var filtered = this.not(function() {
            return $(this).is('.sortable') || $(this).closest('.sortable').length;
        });

    if (this.data('sortable') && typeof options === 'string') {
        return this.data('sortable').invoke(options);
    }

    if (filtered.length && options && options.group) {
        new Sortable(filtered, options);
    } else {
        filtered.each(function(ix, el) {
            new Sortable(el, options);
        });
    }
    return this;
};


/**
 * Draggable plugin.
 */
$.fn.draggable = function(options) {
    if (options === 'destroy') {
        this.trigger('destroy.draggable');
    } else {
        this.not('.draggable').each(function(ix, el) {
            new Draggable(el, options);
        });
    }
    return this;
};


/**
 * Droppable plugin.
 */
$.fn.droppable = function(options) {
    if (options === 'destroy') {
        this.trigger('destroy.droppable');
    } else {
        this.not('.droppable').each(function(ix, el) {
            new Droppable(el, options);
        });
    }
    return this;
};


/**
 * Dragaware plugin.
 */
$.fn.dragaware = function(options) {
    if (options === 'destroy') {
        this.trigger('destroy.dragaware');
    } else {
        this.not('.dragaware').each(function(ix, el) {
            new Dragaware(el, options);
        });
    }
    return this;
};


/**
 * Disables mouse selection.
 */
$.fn.unselectable = function(command) {
    function disable() {
        return false;
    }

    if (command == 'destroy') {
        return this
        .removeClass('unselectable')
        .removeAttr('unselectable')
        .off('selectstart.unselectable');
    } else {
        return this
        .addClass('unselectable')
        .attr('unselectable','on')
        .on('selectstart.unselectable', disable);
    }
};


$.fn.invisible = function() {
    return this.css({visibility: 'hidden'});
};


$.fn.visible = function() {
    return this.css({visibility: 'visible'});
};


$.fn.scrollParent = function() {
    return this.parents().filter(function() {
        var p = $(this);
        return (/(scroll|auto)/).test(p.css("overflow-x") + p.css("overflow-y") + p.css("overflow"));
    });
};


}(jQuery));