var posts=["2024/02/02/linux/包过滤防火墙——iptables静态防火墙的简单使用/","2024/02/02/linux/包过滤防火墙——firewalld动态防火墙的简单使用/","2025/03/10/hello-world/","2024/02/02/linux/Linux基本命令/"];function toRandomPost(){
    pjax.loadUrl('/'+posts[Math.floor(Math.random() * posts.length)]);
  };