<?php

header( "Access-Control-Allow-Origin: *" );

if ( empty( $_POST['image'] ) || 'undefined' === $_POST['image'] ) {
	die( json_encode( array( 'error' => 'Missing image.' ) ) );
}

$image_url = $_POST['image'];

$source = imageCreateFromAny( $image_url );

if ( ! $source ) {
	die( json_encode( array( 'error' => 'Could not load image. Try a different format.' ) ) );
}

$resolution = $_POST['resolution'];

if ( empty( $resolution ) ) {
	$resolution = 20;
}

$source_width = imagesx( $source );
$source_height = imagesy( $source );

if ( $soure_width > $source_height ) {
	$new_width = $resolution;
	$new_height = floor( ( $resolution / $source_width ) * $source_height );
}
else {
	$new_width = floor( ( $resolution / $source_height ) * $source_width );
	$new_height = $resolution;
}

$thumb = imagecreatetruecolor( $new_width, $new_height );
imagesavealpha( $thumb, true );

$trans_colour = imagecolorallocatealpha( $thumb, 0, 0, 0, 127 );
imagefill( $thumb, 0, 0, $trans_colour );

imagecopyresized( $thumb, $source, 0, 0, 0, 0, $new_width, $new_height, $source_width, $source_height );

$response = array(
	'size' => array(
		'width' => (int) $new_width,
		'height' => (int) $new_height,
	),
	'pixels' => array(),
);

for ( $x = 0; $x < $new_width; $x++ ) {
	for ( $y = 0; $y < $new_height; $y++ ) {
		$rgb = imagecolorat( $thumb, $x, $y );

		$alpha = ($rgb & 0x7F000000) >> 24;

		if ( $alpha > 0 ) {
			// Consider all pixels with any transparency to be white.
			$brightness = 255;
		}
		else {
			$r = ($rgb >> 16) & 0xFF;
			$g = ($rgb >> 8) & 0xFF;
			$b = $rgb & 0xFF;

			// See some stack overflow question.
			$brightness = (0.2126 * $r + 0.7152 * $g + 0.0722 * $b);
		}

		$response['pixels'][] = array( 'x' => $x, 'y' => $y, 'l' => round( ( $brightness / 255 ), 2 ) );
	}
}

echo json_encode( $response );

die;

/**
 * See http://php.net/manual/en/function.imagecreatefromjpeg.php#110547
 */
function imageCreateFromAny( $filepath ) {
    $type = exif_imagetype( $filepath ); // [] if you don't have exif you could use getImageSize()

    $allowedTypes = array(
        1, // [] gif
        2, // [] jpg
        3, // [] png
        6, // [] bmp
    );

    if ( ! in_array( $type, $allowedTypes ) ) {
        return false;
    }

    switch ( $type ) {
        case 1:
            $im = imageCreateFromGif( $filepath );
        break;
        case 2:
            $im = imageCreateFromJpeg( $filepath );
        break;
        case 3:
            $im = imageCreateFromPng( $filepath );
        break;
        case 6:
            $im = imageCreateFromBmp( $filepath );
        break;
    }

    return $im;
}