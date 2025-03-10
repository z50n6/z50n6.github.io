var posts=["2025/03/10/hello-world/","2017/12/02/linux/Linux基本命令/"];function toRandomPost(){
    pjax.loadUrl('/'+posts[Math.floor(Math.random() * posts.length)]);
  };