<?php

$data=json_decode(file_get_contents("php://input"),true);

$map=$data["map"];

file_put_contents("map-data/".$map.".json",json_encode($data));

echo "saved";
