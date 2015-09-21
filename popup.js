// Copyright (c) 2015 Sean Kelleher. All rights reserved.

document.addEventListener('DOMContentLoaded', function () {
    renderTags();
    chrome.storage.onChanged.addListener(function (changes, namespace) {
        if (namespace === 'sync') {
            renderTags();
        }
    })

    importBookmarks();
});

function renderTags() {
    chrome.storage.sync.get(null, function (tags) {
        if (chrome.runtime.lastError) {
            console.log(chrome.runtime.lastError);
            return;
        }

        $('#tags').empty();

        var selected = [];
        var ul = $('<ul>');
        $.each(tags, function (tag, bkmks) {
            var chkbx = $('<input type="checkbox" />');
            chkbx.change(function () {
                if ($(this).is(":checked")) {
                    selected.push(tag);
                } else {
                    var index = selected.indexOf(tag);
                    if (index > -1) {
                        selected.splice(index, 1);
                    }
                }
                refreshBookmarks(selected);
            });
            var li = $('<li>');
            li.append(chkbx);
            li.append(document.createTextNode(tag + ' (' + bkmks.length + ')'));
            var options = $('<a id="delete" href="#">X</a>');
            li.hover(
                function () {
                    li.append(options);
                    $('#delete').click(function () {
                        chrome.storage.sync.remove(tag, function () {
                            console.log(chrome.runtime.lastError);
                            return;
                        });
                        li.remove();
                    });
                },
                function () {
                    options.remove();
                }
            );
            ul.append(li);
        });
        $('#tags').append(ul);
    });
}

function refreshBookmarks(selected) {
    $('#bkmks').empty();

    if (!selected.length) {
        return;
    }

    chrome.storage.sync.get(selected, function (tags) {
        var first = true;
        var common = [];
        $.each(tags, function (tag, bkmkIds) {
            if (first) {
                common = bkmkIds;
                first = false;
            } else {
                var i = 0;
                while (i < common.length) {
                    if (bkmkIds.indexOf(common[i]) == -1) {
                        common.splice(i, 1);
                    } else {
                        i++;
                    }
                }
            }
        });

        if (!common.length) {
            return;
        }

        chrome.bookmarks.get(common, function (bkmks) {
            var ul = $('<ul>');
            bkmks.forEach(function (bkmk) {
                var li = $('<li>');
                var edit = $('<a class="edit" href="#edit"><img width="16" height="16" src="edit45.png" alt=""/></a>');
                edit.click(function () {
                    chrome.storage.sync.get(null, function (tags) {
                        if (chrome.runtime.lastError) {
                            console.log(chrome.runtime.lastError);
                            return;
                        }

                        $('#bkmk-tags').empty();
                        var ul = $('<ul>');
                        $.each(tags, function (tag, bkmks) {
                            var checked = bkmks.indexOf(bkmk.id) == -1 ? '' : 'checked="checked" ';
                            var li = $('<li>' + tag + '</li>');
                            var chkbx = $('<input type="checkbox" ' + checked + '/>');
                            chkbx.change(function () {
                                var checked = $(this).is(":checked");

                                chrome.storage.sync.get(tag, function (tags) {
                                    if (chrome.runtime.lastError) {
                                        console.log(chrome.runtime.lastError);
                                        return;
                                    }

                                    var index = tags[tag].indexOf(bkmk.id);
                                    if (index == -1 && checked) {
                                        tags[tag].push(bkmk.id);
                                    } else if (index != -1 && !checked) {
                                        tags[tag].splice(index, 1);
                                    }

                                    chrome.storage.sync.set(tags, function () {
                                        if (chrome.runtime.lastError) {
                                            console.log(chrome.runtime.lastError);
                                            return;
                                        }
                                    });
                                });
                            });
                            li.append(chkbx);
                            ul.append(li);
                        });
                        $('#bkmk-tags').append(ul);

                        $('#edit-dialog').dialog({
                            autoOpen: false,
                            resizable: false,
                            modal: true,
                        }).dialog('open');
                    });
                });
                li.append(edit);
                li.append('<img width="16" height="16" src="http://' + extractDomain(bkmk.url) + '/favicon.ico" />' +
                        '<a href="' + bkmk.url + '">' +
                        (bkmk.title ? bkmk.title : bkmk.url) +
                        '</a>');
                ul.append(li);
            });
            $('#bkmks').append(ul);
        });
    });
}

// Copied from http://stackoverflow.com/a/23945027/497142.
function extractDomain(url) {
    var domain;
    //find & remove protocol (http, ftp, etc.) and get domain
    if (url.indexOf("://") > -1) {
        domain = url.split('/')[2];
    }
    else {
        domain = url.split('/')[0];
    }

    //find & remove port number
    domain = domain.split(':')[0];

    return domain;
}

function importBookmarks() {
    chrome.storage.sync.get(null, function (tags) {
        chrome.bookmarks.getTree(function (nodes) {
            walkBookmarkFolder([], nodes, function (parents, node) {
                var found = false;
                $.each(tags, function (tag, bkmks) {
                    if (bkmks.indexOf(node.id) > -1) {
                        found = true;
                    }
                });

                if (!found) {
                    parents.forEach(function (par) {
                        if (!par) {
                            return;
                        }

                        if (tags[par] === undefined) {
                            tags[par] = [];
                        }
                        tags[par].push(node.id);
                    });
                }
            });

            chrome.storage.sync.set(tags, function () {
                if (chrome.runtime.lastError) {
                    console.log(chrome.runtime.lastError);
                    return;
                }
            });
        });
    });
}

function walkBookmarks(f) {
    chrome.bookmarks.getTree(function (nodes) {
        walkBookmarkFolder([], nodes, f);
    });
}

function walkBookmarkFolder(parents, nodes, f) {
    nodes.forEach(function (node) {
        if (node.url) {
            f(parents, node);
        } else {
            parents.push(node.title);
            walkBookmarkFolder(parents, node.children, f);
            parents.pop();
        }
    });
}
