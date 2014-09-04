!function() {
  // Redirect to https
  if (document.location.protocol === 'http:' &&
      /nodeconf.indutny.com/.test(document.location.href)) {
    document.location.href = document.location.href.replace(/http:/, 'https:');
    return;
  }

  var form = $('#secret-form');
  var status = $('#status');
  var btn = $('#btn').button();

  form.submit(function(e) {
    e.preventDefault();
    var obj = {};
    var arr = form.serializeArray();
    for (var i = 0; i < arr.length; i++)
      obj[arr[i].name] = arr[i].value;

    form.attr('disabled', 'disabled');
    btn.button('loading');
    $.ajax({
      type: 'POST',
      url: '/api/post',
      contentType: false,
      processData: false,
      data: new FormData(this),
      success: function() {
        alert('info', 'Success!');
      },
      error: function() {
        alert('danger', 'Failure...');
      },
      complete: function() {
        form.attr('disabled', false);
        form.find('textarea, input').val('');
        btn.button('reset');
      }
    });
  });

  function alert(type, message) {
    var a = $(function() {/*
      <div class="alert alert-{type}">
        <button type="button" class="close" data-dismiss="alert">
          <span aria-hidden="true">&times;</span>
          <span class="sr-only">Close</span>
        </button>
        {text}
      </div>
    */}.toString().replace(/^function[^{]*{\/\*|\*\/}$/g, '')
                  .replace(/{type}/g, type)
                  .replace(/{text}/g, message));
    status.append(a.alert());
    setTimeout(function() {
      a.slideUp(function() {
        a.remove();
      });
    }, type === 'info' ? 750 : 2000);
  }
}();
